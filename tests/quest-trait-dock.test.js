const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const questPage = fs.readFileSync(path.join(__dirname, "..", "quests.html"), "utf8");

function loadTraitExamples() {
  const data = questPage.match(/const TRAIT_QUEST_EXAMPLES\s*=\s*Object\.freeze\([\s\S]*?\);/);
  const selector = questPage.match(/function getTraitQuestExamples\(id\)\{[\s\S]*?\n\}/);
  assert.ok(data, "trait example data must be defined separately from saved quests");
  assert.ok(selector, "trait example selection helper must exist");
  return vm.runInNewContext(`${data[0]}\n${selector[0]}\n({TRAIT_QUEST_EXAMPLES,getTraitQuestExamples})`);
}

test("each trait has example quests and All combines one from every trait", () => {
  const { TRAIT_QUEST_EXAMPLES, getTraitQuestExamples } = loadTraitExamples();
  const traitIds = ["intel", "str", "cha", "wil"];

  for (const id of traitIds) {
    assert.ok(TRAIT_QUEST_EXAMPLES[id].length >= 2, `${id} needs multiple examples`);
    assert.ok(TRAIT_QUEST_EXAMPLES[id].every(example => example.title && example.detail));
  }

  const allExamples = getTraitQuestExamples("all");
  assert.equal(allExamples.length, traitIds.length);
  assert.deepEqual(JSON.parse(JSON.stringify(allExamples.map(example => example.traitId))), traitIds);
  assert.deepEqual(JSON.parse(JSON.stringify(getTraitQuestExamples("unknown"))), []);
});
