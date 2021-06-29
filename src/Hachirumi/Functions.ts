// Common Functions
export const unixToDate = (unix: string) => {
  const date = parseInt(unix);

  if (isNaN(date)) return undefined;
  return new Date(date * 1000);
};

// Chapter functions
export const chapId = (
  key: string,
  groupKey: string,
  folder: string,
  mangaId: string
) => {
  if (!key || key === undefined)
    throw new Error(`Chapter key in id: ${mangaId} is undefined.`);

  if (!groupKey || groupKey === undefined)
    throw new Error(`Group key in id: ${mangaId} is undefined.`);

  if (!folder || folder === undefined)
    throw new Error(`Folder in id: ${mangaId} is undefined.`);

  return `${key}|${groupKey}|${folder}`;
};

export const chapNum = (num: string, mangaId: string, chapId: string) => {
  if (!num || num === undefined)
    throw new Error(
      `Chapter number in id: ${mangaId}@ ${chapId} is undefined.`
    );

  const parsed = parseInt(num);
  if (isNaN(parsed))
    throw new Error(
      `Chapter number in id: ${mangaId}@ ${chapId} is malformed.`
    );

  return parsed;
};

export const chapName = (name: string) => {
  if (!name) return undefined;
};

export const chapVol = (vol: string, mangaId: string, chapId: string) => {
  if (!vol) return undefined;

  const parsed = parseInt(vol);
  if (isNaN(parsed))
    throw new Error(`Volume number in: ${mangaId}@ ${chapId} is malformed.`);
  return parsed;
};

export const chapGroup = (group: string) => {
  if (!group) return undefined;
  return group;
};
