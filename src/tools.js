/**
 * Thin re-export so existing callers keep requiring "@/tools".
 * The tools live in src/tool-system/, one file per group.
 */
module.exports = require("./tool-system");
