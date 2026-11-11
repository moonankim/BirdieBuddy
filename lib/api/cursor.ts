export function encodeCursor(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

export function decodeCursor(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
    const binary=atob(normalized);
    const bytes=Uint8Array.from(binary,(character)=>character.charCodeAt(0));
    const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown;
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)) throw new Error('invalid cursor');
    return parsed as Record<string,unknown>;
  } catch {
    throw Object.assign(new Error('Invalid cursor.'),{code:'VALIDATION_ERROR'});
  }
}

export type VerificationCursor = { createdAt: string; id: string };

export function decodeVerificationCursor(value:string|null|undefined):VerificationCursor|null{
  const parsed=decodeCursor(value);
  if(!parsed) return null;
  const createdAt=parsed.createdAt;const id=parsed.id;
  const isoTimestamp=typeof createdAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(createdAt);
  if(!isoTimestamp||!Number.isFinite(Date.parse(createdAt as string))||typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
    throw Object.assign(new Error('Invalid cursor.'),{code:'VALIDATION_ERROR'});
  }
  return {createdAt,id};
}
