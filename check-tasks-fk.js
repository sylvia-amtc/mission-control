const { db } = require('/root/.openclaw/workspace/mission-control/app/db.js');

const query = "SELECT * FROM tasks WHERE action_item_id IN (SELECT id FROM action_items WHERE requester LIKE '%todo-sync%' OR requester LIKE '%vp-blocker-sync%')";
const tasks = db.prepare(query).all();

console.log(`Found ${tasks.length} tasks referencing action items that are synced (and thus deleted).`);
if (tasks.length > 0) {
  console.log(tasks);
}
