/**
 * Hand the browser a file built in memory. Used by the log's CSV export and the
 * settings export, which otherwise each grow their own copy of the same anchor
 * dance — including the revokeObjectURL that is easy to forget and leaks the blob.
 */
export const download = (filename, content, type) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
