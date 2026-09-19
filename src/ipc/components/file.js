const fs = require("fs");

const MAX_BYTES = 1024 * 1024;
const SNIFF_BYTES = 8000;

module.exports = {
  name: "file:readContent",
  handler: async (_event, filePath) => {
    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) {
        return { ok: false, error: "Not a file." };
      }

      const handle = await fs.promises.open(filePath, "r");
      try {
        const length = Math.min(stat.size, MAX_BYTES);
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, 0);

        const sniff = buffer.subarray(0, Math.min(length, SNIFF_BYTES));
        if (sniff.includes(0)) {
          return { ok: false, error: "Binary file." };
        }

        return {
          ok: true,
          content: buffer.toString("utf8"),
          truncated: stat.size > MAX_BYTES,
        };
      } finally {
        await handle.close();
      }
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
};
