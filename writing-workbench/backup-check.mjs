/* Writing Workbench M1.8: read-only verification of an existing backup file.
   No persistent writes, network requests or re-identification of the source archive.
   "Valid" only proves the archive contents agree with its own checksum/manifest;
   it does NOT prove the browser downloaded it safely or that the data is backed up
   independently elsewhere. Legacy v1 project archives had no checksum. */
import {ARCHIVE_FORMAT,parseArchive} from './vault.mjs';
import {WORKSPACE_FORMAT,parseWorkspaceArchive} from './workspace-vault.mjs';

function canonicalBackup(value) {
  if (Array.isArray(value)) return value.map(canonicalBackup);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.keys(value).sort().map(key => [key,canonicalBackup(value[key])]));
  return value;
}
function normalizedBackupProject(project) {
  // Older supported archives had no `branches` key. Treat an absent branch
  // list and an empty branch list as equivalent when comparing old backups
  // against a migrated M2.1 database; never hide nonempty alternatives.
  const {updatedAt,_storage,...source}=project;
  const comparable=structuredClone(source);
  for(const scene of comparable.scenes||[]){
    if(!scene.branches?.length)delete scene.branches;
  }
  return canonicalBackup(comparable);
}
export function compareBackupWithSaved(sourceProjects, savedWorkspace) {
  if (!Array.isArray(savedWorkspace?.projects))return {status:'not-checked',matched:0,changed:0,notFound:0};
  const saved=new Map(savedWorkspace.projects.map(p=>[p.id,p]));
  let matched=0,changed=0,notFound=0;
  for(const source of sourceProjects){
    const current=saved.get(source.id);
    if(!current){notFound++;continue;}
    if(JSON.stringify(normalizedBackupProject(current))===JSON.stringify(normalizedBackupProject(source)))matched++;
    else changed++;
  }
  return {status:changed?'different':notFound?(matched?'partial':'not-present'):'match',matched,changed,notFound};
}
let uid=0;
const temporaryId=()=>`backup-review-only-${++uid}`;
export async function inspectBackup(source,savedWorkspace=null){
  const archive=typeof source==='string'?JSON.parse(source):source;
  if(!archive||typeof archive!=='object')throw Error('Not a supported Workbench backup');
  let original,kind,integrity,formatVersion,inventory;
  if(archive.format===ARCHIVE_FORMAT){
    const result=await parseArchive(archive,temporaryId);
    inventory={projects:1,...result.manifest};
    kind='project';formatVersion=result.sourceVersion;
    original=[archive.project];
    integrity=formatVersion===1?'legacy-unchecksummed':'checksum-and-manifest-passed';
  } else if(archive.format===WORKSPACE_FORMAT){
    const parsed=await parseWorkspaceArchive(archive,temporaryId);
    inventory=parsed.manifest;
    kind='workspace';formatVersion=archive.schemaVersion;
    original=archive.payload.projects;
    integrity='checksum-and-manifest-passed';
  } else throw Error('Not a supported Workbench backup');
  return {kind,formatVersion,integrity,counts:inventory,
    titles:original.slice(0,8).map(p=>p.title),
    comparison:compareBackupWithSaved(original,savedWorkspace)};
}
