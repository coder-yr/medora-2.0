<?php
/**
 * Medora 2.0 - Data Quality and Compatibility Profiler
 *
 * Inspects the local disposable database for data anomalies that present
 * risks when migrating from MySQL/SQLite to PostgreSQL.
 * Output is aggregate only; no patient or staff PII is printed.
 */

$dbPath = __DIR__ . '/../database.sqlite';
if (!file_exists($dbPath)) {
    fwrite(STDERR, "Database file not found at: $dbPath\n");
    exit(1);
}

$pdo = new PDO("sqlite:$dbPath", null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

echo "=================================================================\n";
echo "Medora 2.0 - Data Quality & PostgreSQL Profiling Report\n";
echo "=================================================================\n\n";

// 1. Check for VARCHAR Financial Columns and potential invalid characters
$financialChecks = [
    'payment' => ['gross_total', 'amount_received'],
    'invoice_item' => ['unit_price', 'total_price'],
    'invoice_payment' => ['amount'],
    'doctor_share' => ['base_amount', 'doctor_share'],
    'pharmacy_payment' => ['gross_total', 'amount_received'],
    'pharmacy_sale_item' => ['unit_price', 'total_price'],
];

echo "[1] Financial Column Numeric Integrity Checks:\n";
foreach ($financialChecks as $table => $cols) {
    // Check if table exists
    $exists = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='$table'")->fetchColumn();
    if (!$exists) {
        continue;
    }
    foreach ($cols as $col) {
        // Check if column exists
        $colsStmt = $pdo->query("PRAGMA table_info(\"$table\")");
        $colNames = array_column($colsStmt->fetchAll(), 'name');
        if (!in_array($col, $colNames)) {
            continue;
        }

        $totalRows = (int)$pdo->query("SELECT COUNT(*) FROM \"$table\"")->fetchColumn();
        $nullRows = (int)$pdo->query("SELECT COUNT(*) FROM \"$table\" WHERE \"$col\" IS NULL")->fetchColumn();
        $emptyRows = (int)$pdo->query("SELECT COUNT(*) FROM \"$table\" WHERE \"$col\" = ''")->fetchColumn();
        
        // Identify non-numeric strings (not null, not empty, not valid numeric)
        $invalidNumeric = 0;
        $stmt = $pdo->query("SELECT \"$col\" FROM \"$table\" WHERE \"$col\" IS NOT NULL AND \"$col\" != ''");
        while ($val = $stmt->fetchColumn()) {
            if (!is_numeric($val)) {
                $invalidNumeric++;
            }
        }

        printf("  - %s.%s: %d rows | NULL: %d | Empty: %d | Invalid Non-Numeric: %d\n",
            $table, $col, $totalRows, $nullRows, $emptyRows, $invalidNumeric
        );
    }
}

// 2. Check for Zero Dates or Malformed Dates
echo "\n[2] Date and Timestamp Quality Checks:\n";
$dateChecks = [
    'appointment' => ['date', 's_time', 'e_time'],
    'patient' => ['birthdate', 'add_date'],
    'alloted_bed' => ['a_time', 'd_time'],
    'payment' => ['date'],
    'consultation' => ['date', 'started_at', 'ended_at'],
];

foreach ($dateChecks as $table => $cols) {
    $exists = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='$table'")->fetchColumn();
    if (!$exists) {
        continue;
    }
    foreach ($cols as $col) {
        $colsStmt = $pdo->query("PRAGMA table_info(\"$table\")");
        $colNames = array_column($colsStmt->fetchAll(), 'name');
        if (!in_array($col, $colNames)) {
            continue;
        }

        $zeroDates = (int)$pdo->query("SELECT COUNT(*) FROM \"$table\" WHERE \"$col\" LIKE '0000-00-00%'")->fetchColumn();
        $emptyDates = (int)$pdo->query("SELECT COUNT(*) FROM \"$table\" WHERE \"$col\" = ''")->fetchColumn();
        $nullDates = (int)$pdo->query("SELECT COUNT(*) FROM \"$table\" WHERE \"$col\" IS NULL")->fetchColumn();

        printf("  - %s.%s: Zero Dates: %d | Empty Strings: %d | NULL: %d\n",
            $table, $col, $zeroDates, $emptyDates, $nullDates
        );
    }
}

// 3. Foreign Key Integrity Checks (Implicit Links)
echo "\n[3] Implicit Foreign Key Integrity (Orphan Record Checks):\n";
$fkChecks = [
    ['appointment', 'patient', 'patient', 'id'],
    ['appointment', 'doctor', 'doctor', 'id'],
    ['alloted_bed', 'patient', 'patient', 'id'],
    ['alloted_bed', 'bed_id', 'bed', 'id'],
    ['consultation', 'patient_id', 'patient', 'id'],
    ['consultation', 'doctor_id', 'doctor', 'id'],
    ['invoice_item', 'payment_id', 'payment', 'id'],
    ['pharmacy_sale_item', 'pharmacy_payment_id', 'pharmacy_payment', 'id'],
];

foreach ($fkChecks as [$childTable, $childCol, $parentTable, $parentCol]) {
    $childExists = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='$childTable'")->fetchColumn();
    $parentExists = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='$parentTable'")->fetchColumn();
    if (!$childExists || !$parentExists) {
        continue;
    }

    try {
        $sql = "SELECT COUNT(*) FROM \"$childTable\" c 
                WHERE c.\"$childCol\" IS NOT NULL 
                  AND c.\"$childCol\" != '' 
                  AND c.\"$childCol\" != '0'
                  AND NOT EXISTS (SELECT 1 FROM \"$parentTable\" p WHERE p.\"$parentCol\" = c.\"$childCol\")";
        $orphans = (int)$pdo->query($sql)->fetchColumn();
        printf("  - %s.%s -> %s.%s: %d orphan references\n", $childTable, $childCol, $parentTable, $parentCol, $orphans);
    } catch (Exception $e) {
        printf("  - %s.%s -> %s.%s: [Check Skipped: %s]\n", $childTable, $childCol, $parentTable, $parentCol, $e->getMessage());
    }
}

echo "\n=================================================================\n";
echo "Profile Complete.\n";
