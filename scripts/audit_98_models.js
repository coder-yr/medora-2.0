const fs = require('fs');

const schemaContent = fs.readFileSync('backend/prisma/schema.prisma', 'utf8');
const lines = schemaContent.split('\n');

const models = [];
let currentModel = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.startsWith('model ') && line.includes('{')) {
    const modelName = line.split(/\s+/)[1];
    currentModel = {
      modelName,
      hasOrgId: false,
      hasBranchId: false,
      isBranchIdNullable: false,
      hasUserId: false,
      uniqueConstraints: [],
      fields: [],
    };
    models.push(currentModel);
    continue;
  }

  if (currentModel) {
    if (line === '}') {
      currentModel = null;
      continue;
    }
    if (line.startsWith('//') || !line) continue;

    if (line.startsWith('@@unique')) {
      currentModel.uniqueConstraints.push(line);
      continue;
    }

    if (line.startsWith('@@')) continue;

    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const fieldName = parts[0];
      const fieldType = parts[1];
      currentModel.fields.push(fieldName);

      if (fieldName === 'organizationId' || fieldName === 'organization') {
        currentModel.hasOrgId = true;
      }
      if (fieldName === 'branchId') {
        currentModel.hasBranchId = true;
        if (fieldType.endsWith('?')) {
          currentModel.isBranchIdNullable = true;
        }
      }
      if (fieldName === 'userId' || fieldName === 'createdById' || fieldName === 'actorUserId') {
        currentModel.hasUserId = true;
      }
      if (line.includes('@unique')) {
        currentModel.uniqueConstraints.push(`@unique on ${fieldName}`);
      }
    }
  }
}

console.log(`Parsed ${models.length} models from schema.`);

fs.writeFileSync('scripts/models_audit.json', JSON.stringify(models, null, 2));

const directOrg = models.filter(m => m.hasOrgId);
const branchLinked = models.filter(m => m.hasBranchId);
const nullableBranch = models.filter(m => m.hasBranchId && m.isBranchIdNullable);
const neither = models.filter(m => !m.hasOrgId && !m.hasBranchId);

console.log(`Direct Organization Models: ${directOrg.length}`);
directOrg.forEach(m => console.log(`  - ${m.modelName}`));

console.log(`\nBranch Linked Models: ${branchLinked.length} (Nullable branchId: ${nullableBranch.length})`);
branchLinked.forEach(m => console.log(`  - ${m.modelName} (nullable: ${m.isBranchIdNullable})`));

console.log(`\nNeither Org nor Branch Models: ${neither.length}`);
neither.forEach(m => console.log(`  - ${m.modelName}`));
