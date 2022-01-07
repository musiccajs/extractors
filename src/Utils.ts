export default class Utils {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static chunk<T = any>(array: T[], size: number): T[][] {
    const chunks = [];
    while (array.length > 0) chunks.push(array.splice(0, size));

    return chunks;
  }
}