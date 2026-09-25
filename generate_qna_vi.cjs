const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

// The server catalog contains authored translations. Never synthesize missing text.
// Run this script to validate it and synchronize the client data copy.
const sourcePath = path.join(__dirname, 'server/src/data/qna.vi.json');
const english = require('./server/src/data/qna.json');
const vietnamese = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const originals = new Map(english.questions.map(question => [question.id, question]));

assert.equal(vietnamese.version, english.version, 'Catalog versions must match');
assert.equal(vietnamese.questions.length, originals.size, 'Every question needs a translation');
assert.equal(new Set(vietnamese.questions.map(question => question.id)).size, originals.size, 'Question IDs must be unique');
for (const question of vietnamese.questions) {
  const original = originals.get(question.id);
  assert.ok(original, `Unknown question ID: ${question.id}`);
  assert.equal(question.category, original.category, `Keep canonical category for ${question.id}`);
  assert.ok(question.text.trim() && question.text !== original.text, `Translate question ${question.id}`);
  assert.equal(question.options.length, original.options.length, `Missing options for ${question.id}`);
  assert.equal(new Set(question.options.map(option => option.trim().toLocaleLowerCase('vi'))).size, original.options.length, `Duplicate options for ${question.id}`);
  assert.ok(question.options.every(option => option.trim()), `Blank option for ${question.id}`);
  assert.ok(!/\(vi\)|Câu hỏi về /i.test([question.text, ...question.options].join(' ')), `Placeholder translation in ${question.id}`);
}

const formatted = JSON.stringify(vietnamese, null, 2) + '\n';
fs.writeFileSync(sourcePath, formatted);
fs.writeFileSync(path.join(__dirname, 'client/src/data/qna.vi.json'), formatted);
console.log(`Validated and synchronized ${vietnamese.questions.length} Vietnamese questions.`);
