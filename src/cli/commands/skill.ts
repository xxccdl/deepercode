import { readdirSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bootstrap } from '../bootstrap.ts';
import { DEEPER_SKILLS_DIR, PROJECT_SKILLS_DIR } from '../../core/constants.ts';

export async function skillCommand(args: string[]): Promise<void> {
  const result = await bootstrap();
  if (!result.success) {
    for (const err of result.errors) {
      console.error(`❌ ${err}`);
    }
    process.exit(1);
  }

  const subcommand = args[0] || 'list';

  switch (subcommand) {
    case 'list':
    case 'ls': {
      console.log('\n🧩 DeeperCode Skills:\n');

      const homeSkills = listSkills(DEEPER_SKILLS_DIR);
      console.log(`📁 全局 Skills (${DEEPER_SKILLS_DIR}):`);
      if (homeSkills.length === 0) {
        console.log('   (无)');
      } else {
        for (const skill of homeSkills) {
          console.log(`   📦 ${skill.name} - ${skill.description}`);
        }
      }

      const cwd = process.cwd();
      const projectSkillsDir = join(cwd, PROJECT_SKILLS_DIR);
      if (existsSync(projectSkillsDir)) {
        const projectSkills = listSkills(projectSkillsDir);
        console.log(`\n📁 项目 Skills (${projectSkillsDir}):`);
        if (projectSkills.length === 0) {
          console.log('   (无)');
        } else {
          for (const skill of projectSkills) {
            console.log(`   📦 ${skill.name} - ${skill.description}`);
          }
        }
      }

      console.log();
      break;
    }

    case 'create': {
      const name = args[1];
      if (!name) {
        console.error('❌ 用法: deeper skill create <name>');
        process.exit(1);
      }

      const targetDir = join(DEEPER_SKILLS_DIR, name);
      if (existsSync(targetDir)) {
        console.error(`❌ Skill "${name}" 已存在`);
        process.exit(1);
      }

      try {
        mkdirSync(targetDir, { recursive: true });
        const skillDef = {
          name,
          version: '1.0.0',
          description: `${name} 技能`,
          triggers: [],
          steps: [],
        };
        writeFileSync(
          join(targetDir, 'skill.json'),
          JSON.stringify(skillDef, null, 2),
          'utf-8',
        );
        console.log(`✅ Skill "${name}" 已创建: ${targetDir}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`❌ 创建失败: ${msg}`);
        process.exit(1);
      }
      break;
    }

    case 'info': {
      const name = args[1];
      if (!name) {
        console.error('❌ 用法: deeper skill info <name>');
        process.exit(1);
      }

      const skillPath = join(DEEPER_SKILLS_DIR, name, 'skill.json');
      if (!existsSync(skillPath)) {
        console.error(`❌ Skill "${name}" 不存在`);
        process.exit(1);
      }

      try {
        const content = readFileSync(skillPath, 'utf-8');
        const skillDef = JSON.parse(content);
        console.log(JSON.stringify(skillDef, null, 2));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`❌ 读取失败: ${msg}`);
        process.exit(1);
      }
      break;
    }

    default: {
      console.log(`
🧩 DeeperCode Skill 管理

用法:
  deeper skill list               列出所有 Skills
  deeper skill create <name>      创建新 Skill
  deeper skill info <name>        查看 Skill 详情

示例:
  deeper skill list
  deeper skill create my-skill
  deeper skill info my-skill
`);
      break;
    }
  }
}

function listSkills(dir: string): { name: string; description: string }[] {
  try {
    if (!existsSync(dir)) return [];
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const skillFile = join(dir, e.name, 'skill.json');
        if (existsSync(skillFile)) {
          try {
            const content = readFileSync(skillFile, 'utf-8');
            const def = JSON.parse(content);
            return { name: def.name || e.name, description: def.description || '' };
          } catch {
            return { name: e.name, description: '' };
          }
        }
        return { name: e.name, description: '' };
      });
  } catch {
    return [];
  }
}
