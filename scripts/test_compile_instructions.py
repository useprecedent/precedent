import json
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("compile_instructions.py")


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def compile_workspace(root: Path, home: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["python3", str(SCRIPT), "--root", str(root), "--home", str(home)],
        capture_output=True,
        text=True,
        check=False,
    )


class CompileInstructionsTest(unittest.TestCase):
    def test_inventory_classifies_orders_and_skips_noise(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            home = (Path(tmp) / "home").resolve()
            root = (home / "projects" / "app").resolve()
            write(home / "CLAUDE.md", "Ancestor says the agent runs commands.\n")
            write(
                home / ".cursor" / "rules" / "commands.mdc",
                "---\nalwaysApply: true\n---\n\nThe user runs every command.\n",
            )
            write(root / "CLAUDE.md", "Project says to run npm run verify.\n")
            write(root / "AGENTS.md", "Project agents file.\n")
            write(root / "apps" / "web" / "AGENTS.md", "Web agents file.\n")
            (root / "apps" / "web" / "CLAUDE.md").symlink_to("AGENTS.md")
            write(root / "node_modules" / "pkg" / "CLAUDE.md", "Ignore this package.\n")
            write(root / ".cursor" / "rules" / "notes.md", "Plain markdown is not a rule.\n")
            write(
                root / ".cursor" / "rules" / "always.mdc",
                "---\ndescription: Test first\nalwaysApply: true\n---\n\nWrite a failing test first.\n",
            )
            write(
                root / ".cursor" / "rules" / "glob.mdc",
                "---\nglobs: src/**/*.ts, tests/**/*.ts\nalwaysApply: false\n---\n\nType the boundary.\n",
            )
            write(
                root / ".cursor" / "rules" / "intelligent.mdc",
                "---\ndescription: Use when editing API handlers\nalwaysApply: false\n---\n\nValidate at the boundary.\n",
            )
            write(
                root / ".cursor" / "rules" / "manual.mdc",
                "---\nalwaysApply: false\n---\n\nOnly when named.\n",
            )

            completed = compile_workspace(root, home)

        self.assertEqual(completed.returncode, 0, completed.stderr)
        payload = json.loads(completed.stdout)
        sources = payload["sources"]
        by_path = {source["path"]: source for source in sources}

        self.assertEqual(
            [source["path"] for source in sources],
            sorted(
                by_path,
                key=lambda path: (
                    0 if by_path[path]["layer"] == "project" else 1,
                    -by_path[path]["specificity"],
                    path,
                ),
            ),
        )
        self.assertNotIn("node_modules/pkg/CLAUDE.md", by_path)
        self.assertNotIn(".cursor/rules/notes.md", by_path)

        web = by_path["apps/web/AGENTS.md"]
        self.assertEqual(web["kind"], "agents-md")
        self.assertEqual(web["layer"], "project")
        self.assertEqual(web["activation"], "always")
        self.assertEqual(web["specificity"], 2)
        self.assertEqual(web["appliesUnder"], "apps/web")
        self.assertIn("Web agents file.", web["body"])
        self.assertNotIn("aliasOf", web)

        linked = by_path["apps/web/CLAUDE.md"]
        self.assertEqual(linked["kind"], "claude-md")
        self.assertEqual(linked["specificity"], 2)
        self.assertEqual(linked["appliesUnder"], "apps/web")
        self.assertEqual(linked["aliasOf"], "AGENTS.md")
        self.assertIn("Web agents file.", linked["body"])

        always = by_path[".cursor/rules/always.mdc"]
        self.assertEqual(always["activation"], "always")
        self.assertEqual(always["specificity"], 0)
        self.assertIn("Write a failing test first.", always["body"])

        glob = by_path[".cursor/rules/glob.mdc"]
        self.assertEqual(glob["activation"], "glob")
        self.assertEqual(glob["globs"], ["src/**/*.ts", "tests/**/*.ts"])
        self.assertNotIn("body", glob)

        intelligent = by_path[".cursor/rules/intelligent.mdc"]
        self.assertEqual(intelligent["activation"], "intelligent")
        self.assertEqual(intelligent["description"], "Use when editing API handlers")
        self.assertNotIn("body", intelligent)

        manual = by_path[".cursor/rules/manual.mdc"]
        self.assertEqual(manual["activation"], "manual")
        self.assertNotIn("body", manual)

        ancestor_path = str((home / "CLAUDE.md").resolve())
        ancestor = by_path[ancestor_path]
        self.assertEqual(ancestor["kind"], "claude-md")
        self.assertEqual(ancestor["layer"], "project")
        self.assertEqual(ancestor["specificity"], -2)
        self.assertIsNone(ancestor["appliesUnder"])

        user = by_path[str((home / ".cursor" / "rules" / "commands.mdc").resolve())]
        self.assertEqual(user["kind"], "user-rule")
        self.assertEqual(user["layer"], "user")
        self.assertEqual(user["activation"], "always")
        self.assertIn("The user runs every command.", user["body"])
        self.assertEqual(sources[-1]["path"], user["path"])

    def test_inventory_plugin_rules_and_user_skills(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            home = (Path(tmp) / "home").resolve()
            root = (home / "projects" / "app").resolve()
            write(root / "AGENTS.md", "Root agents file.\n")
            write(
                root / ".cursor" / "plugins" / "ship" / "rules" / "always.mdc",
                "---\nalwaysApply: true\n---\n\nBind HTTP servers to 0.0.0.0.\n",
            )
            write(
                root / ".cursor" / "plugins" / "ship" / "skills" / "deploy" / "SKILL.md",
                "---\nname: deploy\ndescription: Deploy the app\n---\n\nDeploy skill.\n",
            )
            write(
                root / ".cursor" / "skills" / "gated" / "SKILL.md",
                "---\nname: gated\ndescription: Use when gating\ndisable-model-invocation: true\n---\n\nGated skill.\n",
            )
            write(root / "pack" / ".cursor-plugin" / "plugin.json", '{"name":"pack"}\n')
            write(
                root / "pack" / "rules" / "always.mdc",
                "---\nalwaysApply: true\n---\n\nPack always-on plugin rule.\n",
            )
            write(home / ".cursor" / "skills" / "personal" / "SKILL.md", "Personal cursor skill.\n")
            write(home / ".cursor" / "skills-cursor" / "builtin" / "SKILL.md", "Ignore builtin.\n")
            write(
                home / ".cursor" / "plugins" / "local" / "acme" / "rules" / "local-always.mdc",
                "---\nalwaysApply: true\n---\n\nLocal plugin always-on rule.\n",
            )
            write(
                home / ".cursor" / "plugins" / "cache" / "marketplace" / "rules" / "cache-always.mdc",
                "---\nalwaysApply: true\n---\n\nCache plugin must not be inventoried.\n",
            )

            completed = compile_workspace(root, home)

        self.assertEqual(completed.returncode, 0, completed.stderr)
        payload = json.loads(completed.stdout)
        by_path = {source["path"]: source for source in payload["sources"]}
        plugin = by_path[".cursor/plugins/ship/rules/always.mdc"]
        self.assertEqual(plugin["kind"], "plugin-rule")
        self.assertEqual(plugin["activation"], "always")
        self.assertEqual(plugin["layer"], "project")
        self.assertIn("Bind HTTP servers", plugin["body"])
        skill = by_path[".cursor/plugins/ship/skills/deploy/SKILL.md"]
        self.assertEqual(skill["kind"], "skill")
        self.assertEqual(skill["activation"], "intelligent")
        gated = by_path[".cursor/skills/gated/SKILL.md"]
        self.assertEqual(gated["kind"], "skill")
        self.assertEqual(gated["activation"], "manual")
        pack = by_path["pack/rules/always.mdc"]
        self.assertEqual(pack["kind"], "plugin-rule")
        personal = next(source for source in payload["sources"] if source["path"].endswith("skills/personal/SKILL.md"))
        self.assertEqual(personal["layer"], "user")
        local = next(source for source in payload["sources"] if str(source["path"]).endswith("local-always.mdc"))
        self.assertEqual(local["kind"], "plugin-rule")
        self.assertEqual(local["layer"], "user")
        self.assertFalse(any("skills-cursor" in str(source["path"]) for source in payload["sources"]))
        self.assertFalse(any("cache-always.mdc" in str(source["path"]) for source in payload["sources"]))
        self.assertIn("Cursor marketplace plugins (enabled set is not on disk)", payload["missingFromDisk"])

    def test_redacts_secrets_in_inventory_bodies(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            home = (Path(tmp) / "home").resolve()
            root = (home / "projects" / "app").resolve()
            write(
                root / "AGENTS.md",
                "Never commit api_key=sk-super-secret-value-123456 in examples.\n",
            )

            completed = compile_workspace(root, home)

        self.assertEqual(completed.returncode, 0, completed.stderr)
        payload = json.loads(completed.stdout)
        body = next(source["body"] for source in payload["sources"] if source["path"] == "AGENTS.md")
        self.assertNotIn("sk-super-secret-value-123456", body)
        self.assertIn("[REDACTED]", body)

    def test_missing_root_exits_with_an_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            completed = compile_workspace(Path(tmp) / "missing", Path(tmp) / "home")

        self.assertEqual(completed.returncode, 2)
        self.assertIn("root is not a directory", completed.stderr)
        self.assertEqual(completed.stdout, "")


if __name__ == "__main__":
    unittest.main()
