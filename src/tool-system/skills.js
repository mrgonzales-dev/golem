/**
 * invokeSkill: playbooks under src/default_skills/<name>/skill.md.
 * The tool is only registered when at least one skill exists.
 */
const fs = require("fs");
const path = require("path");

const skillsDir = path.join(__dirname, "..", "default_skills");

/**
 * List available skills or invoke a specific skill by name.
 * When no skillName is given, returns a list of skills with descriptions.
 * When skillName is given, returns the full skill markdown content.
 * @param {Object} args - The arguments.
 * @param {string} [args.skillName] - The name of the skill to invoke.
 * @returns {string} The skill list or skill content.
 */
function invokeSkill({ skillName } = {}) {
  if (!fs.existsSync(skillsDir)) {
    return "Skills are empty";
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skillFolders = entries.filter((e) => e.isDirectory());

  if (skillFolders.length === 0) {
    return "Skills are empty";
  }

  if (!skillName) {
    const skills = [];
    for (const folder of skillFolders) {
      const skillFile = path.join(skillsDir, folder.name, "skill.md");
      if (!fs.existsSync(skillFile)) continue;

      const raw = fs.readFileSync(skillFile, "utf-8");
      const descMatch = raw.match(/^description:\s*(.+)$/m);
      const whenMatch = raw.match(/^when_to_use:\s*(.+)$/m);

      skills.push({
        name: folder.name,
        description: descMatch ? descMatch[1].trim() : "No description",
        when_to_use: whenMatch ? whenMatch[1].trim() : "No usage info",
      });
    }

    if (skills.length === 0) {
      return "Skills are empty";
    }

    return JSON.stringify(skills, null, 2);
  }

  const skillFile = path.join(skillsDir, skillName, "skill.md");
  if (!fs.existsSync(skillFile)) {
    return `Error: Skill "${skillName}" not found`;
  }

  return fs.readFileSync(skillFile, "utf-8");
}

/**
 * Names of the available skills, for the system prompt.
 * @returns {string[]} The skill folder names that hold a skill.md.
 */
function listSkillNames() {
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() &&
        fs.existsSync(path.join(skillsDir, e.name, "skill.md")),
    )
    .map((e) => e.name)
    .sort();
}

/**
 * Check if the skills directory has any skill folders with skill.md files.
 * @returns {boolean} True if at least one skill is available.
 */
function hasSkills() {
  return listSkillNames().length > 0;
}

const definitions = [
  {
    type: "function",
    function: {
      name: "invokeSkill",
      description:
        "List available skills with descriptions, or invoke a specific skill by name to get its full content. Call without skillName to see available skills. Call with skillName to get the skill's markdown content.",
      parameters: {
        type: "object",
        properties: {
          skillName: {
            type: "string",
            description:
              "The name of the skill to invoke. Omit to list all available skills.",
          },
        },
        required: [],
      },
    },
  },
];

module.exports = { invokeSkill, listSkillNames, hasSkills, skillsDir, definitions };
