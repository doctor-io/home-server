import "server-only";

import { runSystemBackupNow } from "@/lib/server/modules/system/backup-service";

export async function runScheduledBackup() {
  await runSystemBackupNow();
}

if (require.main === module) {
  void runScheduledBackup().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
