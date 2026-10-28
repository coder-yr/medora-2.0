<?php
/**
 * Medora 2.0 - Database Schema Inspection Tool
 *
 * Reads table structures, column definitions, keys, and row counts from
 * the local disposable SQLite database in a strictly read-only manner.
 * Never outputs sensitive patient or staff data.
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

$tablesStmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
$tableNames = $tablesStmt->fetchAll(PDO::FETCH_COLUMN);

$schema = [];
$totalColumns = 0;
$tablesWithFks = 0;
$tablesWithSoftDeletes = 0;
$tablesWithTimestamps = 0;

foreach ($tableNames as $table) {
    // Columns
    $colsStmt = $pdo->query("PRAGMA table_info(\"$table\")");
    $columns = $colsStmt->fetchAll();
    $totalColumns += count($columns);

    // Foreign Keys
    $fksStmt = $pdo->query("PRAGMA foreign_key_list(\"$table\")");
    $fks = $fksStmt->fetchAll();
    if (!empty($fks)) {
        $tablesWithFks++;
    }

    // Indexes
    $indexesStmt = $pdo->query("PRAGMA index_list(\"$table\")");
    $rawIndexes = $indexesStmt->fetchAll();
    $indexes = [];
    foreach ($rawIndexes as $idx) {
        $idxName = $idx['name'];
        $idxColsStmt = $pdo->query("PRAGMA index_info(\"$idxName\")");
        $idxCols = $idxColsStmt->fetchAll();
        $indexes[] = [
            'name' => $idxName,
            'unique' => (bool)$idx['unique'],
            'columns' => array_column($idxCols, 'name'),
        ];
    }

    // Row Count (Safe Aggregate Only)
    try {
        $countStmt = $pdo->query("SELECT COUNT(*) FROM \"$table\"");
        $rowCount = (int)$countStmt->fetchColumn();
    } catch (Exception $e) {
        $rowCount = -1;
    }

    $colNames = array_column($columns, 'name');
    $hasDeletedAt = in_array('deleted_at', $colNames);
    if ($hasDeletedAt) {
        $tablesWithSoftDeletes++;
    }
    $hasTimestamps = in_array('created_at', $colNames) && in_array('updated_at', $colNames);
    if ($hasTimestamps) {
        $tablesWithTimestamps++;
    }

    $schema[$table] = [
        'columns' => $columns,
        'foreign_keys' => $fks,
        'indexes' => $indexes,
        'row_count' => $rowCount,
        'has_soft_deletes' => $hasDeletedAt,
        'has_timestamps' => $hasTimestamps,
    ];
}

$isJson = in_array('--json', $argv ?? []);

if ($isJson) {
    echo json_encode([
        'summary' => [
            'total_tables' => count($tableNames),
            'total_columns' => $totalColumns,
            'tables_with_fks' => $tablesWithFks,
            'tables_with_soft_deletes' => $tablesWithSoftDeletes,
            'tables_with_timestamps' => $tablesWithTimestamps,
        ],
        'tables' => $schema,
    ], JSON_PRETTY_PRINT);
    exit(0);
}

echo "=================================================================\n";
echo "Medora 2.0 - SQLite Schema Inspection Report\n";
echo "=================================================================\n";
echo "Database: " . realpath($dbPath) . "\n";
echo "Total Tables Discovered: " . count($tableNames) . "\n";
echo "Total Columns: " . $totalColumns . "\n";
echo "Tables with Explicit Foreign Keys: " . $tablesWithFks . "\n";
echo "Tables with soft-deletes (deleted_at): " . $tablesWithSoftDeletes . "\n";
echo "Tables with standard timestamps (created_at/updated_at): " . $tablesWithTimestamps . "\n";
echo "=================================================================\n\n";

printf("%-35s | %-8s | %-6s | %-6s | %-12s\n", "Table Name", "Columns", "PKs", "FKs", "Rows");
echo str_repeat("-", 75) . "\n";

foreach ($schema as $name => $info) {
    $pkCount = count(array_filter($info['columns'], fn($c) => $c['pk'] > 0));
    $fkCount = count($info['foreign_keys']);
    printf("%-35s | %-8d | %-6d | %-6d | %-12s\n", 
        $name, 
        count($info['columns']), 
        $pkCount, 
        $fkCount, 
        $info['row_count'] >= 0 ? number_format($info['row_count']) : "N/A"
    );
}
echo str_repeat("-", 75) . "\n";
