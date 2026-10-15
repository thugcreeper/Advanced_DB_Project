const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const output=path.resolve(__dirname,'../../backend/migration-local');
const read=name=>JSON.parse(fs.readFileSync(path.join(output,name),'utf8'));
const sourceBefore=read('source-before.json'),sourceAfter=read('source-after.json');
const targetBefore=read('target-before.json'),targetAfter=read('target-after.json');
assert.deepEqual(sourceAfter.nodes,sourceBefore.nodes);assert.deepEqual(sourceAfter.relationships,sourceBefore.relationships);
assert.deepEqual(sourceAfter.constraints,sourceBefore.constraints);
const definition=index=>Object.fromEntries(['id','name','type','entityType','labelsOrTypes','properties','indexProvider','owningConstraint'].map(key=>[key,index[key]]));
assert.deepEqual(sourceAfter.indexes.map(definition),sourceBefore.indexes.map(definition));
for(const constraint of targetBefore.constraints)assert.deepEqual(targetAfter.constraints.find(row=>row.name===constraint.name),constraint);
for(const index of targetBefore.indexes)assert.deepEqual(definition(targetAfter.indexes.find(row=>row.name===index.name)),definition(index));
const nodes=new Map(targetAfter.nodes.map(row=>[row.id,row])),relationships=new Map(targetAfter.relationships.map(row=>[row.id,row]));
for(const node of targetBefore.nodes)assert.deepEqual(nodes.get(node.id),node);
// This installation was already renamed: the original statistics relationship IDs must also remain intact.
for(const relationship of targetBefore.relationships)assert.deepEqual(relationships.get(relationship.id),relationship);
const report={passed:true,sourceNodes:sourceBefore.nodes.length,sourceRelationships:sourceBefore.relationships.length,protectedTargetNodes:targetBefore.nodes.length,
  protectedTargetRelationships:targetBefore.relationships.length,sourceConstraintsPreserved:true,sourceIndexDefinitionsPreserved:true,targetOriginalSchemaPreserved:true,
  indexVolatileFieldsExcluded:['lastRead','readCount','populationPercent','state']};
fs.writeFileSync(path.join(output,'schema-preservation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
