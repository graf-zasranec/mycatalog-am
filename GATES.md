# Gates: colour and photo completion

OWNS: images/cut/**, images/thumb/**, data/**, GATES.md

Scope: Complete verified offered-colour photos first, then validate the remaining catalogue photo queue.

- [x] G1: Project regression tests pass after colour-photo updates
  CHECK: npm test
  EXPECT: app self-test: 418 checks pass
  EVIDENCE: automatic-evidence=v1; definition-sha256=98a65d2a258586d08cc0f1523e752978bc7224ccea55d04d35b694ca73a38f52; exit=0; EXPECT=matched; output-sha256=50ffd30f2eb03f7fe3855aa2d15255c4b7e23181a42d41f777c55cecefa7a57b; output-bytes=357; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\hastv\Videos\Better-performance; path=847eeca5568d/32 entries

- [x] G2: Every newly installed colour master has a visible product edge of at least 600 pixels
  CHECK: node -e "const fs=require('fs');const {execFileSync}=require('child_process');const p=['apple-watch-ultra-4-gps-plus-cellular-plus-band__natural','nothing-phone-lite-6974434227026__black','nothing-phone-pro-6974434224483__black','xiaomi-poco-m5__black'];for(const x of p){const f='images/cut/'+x+'.webp';if(!fs.existsSync(f))throw Error('missing '+f);const s=execFileSync('python',['-c',\"from PIL import Image; import sys; print(max(Image.open(sys.argv[1]).size))\",f],{encoding:'utf8'}).trim();if(Number(s)<600)throw Error('undersized '+f)}console.log('COLOUR PHOTO DIMENSIONS PASS')"
  EXPECT: COLOUR PHOTO DIMENSIONS PASS
  EVIDENCE: automatic-evidence=v1; definition-sha256=f2431085c2970fda04e41a59cdfab34787253c487a5d7de12d7c9b2252529150; exit=0; EXPECT=matched; output-sha256=32d9b334e7b9fc38b76b00846d083f25c9412f74d537814026222ca5d9f82fb9; output-bytes=29; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\hastv\Videos\Better-performance; path=847eeca5568d/32 entries

- [x] G3: Remaining colour and undersized-photo counts are measured before the next batch
  CHECK: node -e "const j=require('./.codex/new-products/active-photo-audit.json');if(!Number.isInteger(j.activePhotos)||!Array.isArray(j.missingColorPhotos)||!Number.isInteger(j.below600))throw Error('invalid audit');console.log('PHOTO AUDIT MEASURED '+j.activePhotos+' '+j.missingColorPhotos.length+' '+j.below600)"
  EXPECT: PHOTO AUDIT MEASURED
  EVIDENCE: automatic-evidence=v1; definition-sha256=399727426a890c88caadf9c32142e60ddd3bca954188dae43593bef15073d18e; exit=0; EXPECT=matched; output-sha256=e799f9b71232acd67af8e9c2af38eee52b92069f6020b93278d63698b70c9b1f; output-bytes=32; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\hastv\Videos\Better-performance; path=847eeca5568d/32 entries
