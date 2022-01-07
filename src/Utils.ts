export default class Utils {
  /**
   * Chunk an array to smaller chunks of size
   * @template T Array type
   * @param array
   * @param size
   *
   * @returns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static chunk<T = any>(array: T[], size: number): T[][] {
    const chunks = [];
    while (array.length > 0) chunks.push(array.splice(0, size));

    return chunks;
  }
}