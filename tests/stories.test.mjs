import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORIES } from '../js/stories/index.js';

const KNOWN_TYPES = new Set([
  'narr', 'vote', 'quiz', 'likely', 'write', 'dice', 'end', 'leaderboard', 'custom',
  'pool', 'spotlight', 'alliance', 'split', 'tempt', 'ending', 'exile',
]);

function staticRefs(scene) {
  const refs = [];
  for (const key of ['next', 'nextSuccess', 'nextFail']) if (typeof scene[key] === 'string') refs.push(scene[key]);
  for (const o of scene.options ?? []) if (typeof o.goto === 'string') refs.push(o.goto);
  return refs;
}

for (const story of STORIES) {
  for (const length of [30, 60]) {
    test(`${story.id} (${length} min) has a valid scene graph`, () => {
      const game = story.build(length);
      assert.ok(game.scenes[game.start], 'start scene exists');
      for (const [id, scene] of Object.entries(game.scenes)) {
        assert.ok(KNOWN_TYPES.has(scene.type), `${id}: unknown type ${scene.type}`);
        if (scene.type === 'custom') assert.equal(typeof scene.run, 'function', `${id}: custom needs run`);
        for (const ref of staticRefs(scene)) assert.ok(ref === 'END' || game.scenes[ref], `${id} → missing ${ref}`);
        if (scene.type === 'ending') {
          assert.ok(scene.endings.length >= 3, `${id}: at least 3 endings`);
          assert.equal(scene.endings.at(-1).when({ flags: {} }), true, `${id}: last ending must be a fallback`);
        }
      }
    });
  }
}
