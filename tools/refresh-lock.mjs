import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export const refreshLockPath = fileURLToPath(new URL('../.refresh.lock', import.meta.url));
export function acquireRefreshLock(path = refreshLockPath) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(path, 'wx');
      fs.writeFileSync(fd, JSON.stringify({pid:process.pid,started:new Date().toISOString()}));
      fs.closeSync(fd);
      return () => {
        try { if (JSON.parse(fs.readFileSync(path,'utf8')).pid === process.pid) fs.unlinkSync(path); } catch {}
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner;
      try { owner=JSON.parse(fs.readFileSync(path,'utf8')); } catch { return null; }
      try { process.kill(owner.pid,0); return null; }
      catch (e) { if(e.code !== 'ESRCH') return null; }
      try { fs.unlinkSync(path); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
  }
  return null;
}
