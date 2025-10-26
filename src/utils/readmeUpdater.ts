import { readFileSync, writeFileSync, existsSync } from 'fs';

import { join } from 'path';

interface CommitRecord {
  timestamp: string;
  branch: string;
  commitHash: string;
  message: string;
  changes: {
    addedLines: number;
    deletedLines: number;
    modifiedFiles: number;
    addedFiles: number;
    deletedFiles: number;
    complexity?: string;
    changePattern?: string;
    fridayAnalysis?: string;
  };
  files: {
    modified: string[];
    added: string[];
    deleted: string[];
    fileTypes: string[];
  };
}

/**
 * 检查是否存在readme文件
 */
export function checkChangelogExists(projectPath: string = ''): string | null {
  const possibleNames = ['CHANGELOG.md', 'Changelog.md', 'changelog.md'];

  for (const name of possibleNames) {
    const filePath = join(projectPath, name);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}
/**
 * 获取项目名称
 * @param projectPath
 */
function getProjectName(projectPath: string) {
  try {
    const packageJsonPath = join(projectPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      return packageJson.name || 'Unknown Project';
    }
  } catch (e) {}
  //   尝试从目录名获取
  const pathParts = projectPath.split('/');
  return pathParts[pathParts.length - 1] || 'Unknown Project';
}

/**
 * 创建changelog文件
 * @param projectPath
 */
export function createChangelog(projectPath: string = ''): string {
  const changelogPath = join(projectPath, 'CHANGELOG.md');
  const projectName = getProjectName(projectPath);
  const content = `# ${projectName} 变更日志

  此文件由git-commit-analyzer自动生成，用于记录项目的变更历史。
  
  ## 📝 最新提交记录

  <!-- 这里将自动插入最新的提交记录 -->

  ---

  ## 📝 项目信息

  - **项目名称**: ${projectName}
  - **创建时间**: ${new Date().toLocaleString('zh-CN')}
  - **工具版本**: Git Commit Analyzer v1.0.0

  ## 📈 提交统计

  <!-- 这里将自动插入提交统计信息 -->
  
  ---

  *最后更新：${new Date().toLocaleString('zh-CN')}*
  `;
  writeFileSync(changelogPath, content, 'utf-8');
  return changelogPath;
}

/**
 * 更新changelog文件，添加新的提交记录
 */

export function updateChangelog(commitRecord: CommitRecord, projectPath: string = '') {
  let changeLogpath = checkChangelogExists(projectPath);

  if (!changeLogpath) {
    changeLogpath = createChangelog(projectPath);
  }

  //  读取现有内容
  const existingContent = readFileSync(changeLogpath, 'utf-8');

  //   生成新的提交记录
  const newRecord = generateCommitRecordMarkdown(commitRecord);

  //   查找插入位置（在“最新提交记录”部分之后）
  const insertPattern = /(## 📝 最新提交记录\s*\n)/;
  const match = existingContent.match(insertPattern);
  let updateContent: string;

  if (match) {
    const insertIndex = match.index! + match[0].length;
    updateContent = `${existingContent.slice(0, insertIndex) + newRecord}\n${existingContent.slice(insertIndex)}`;
  } else {
    // 如果找不到“最新提交记录”模式，查找“提交历史”模式
    const historyPattern = /(## 📝 提交历史\s*\n)/;
    const historyMatch = existingContent.match(historyPattern);
    if (historyMatch) {
      const historyIndex = historyMatch.index! + historyMatch[0].length;
      updateContent = `${existingContent.slice(0, historyIndex) + newRecord}\n${existingContent.slice(historyIndex)}`;
    } else {
      // 如果都找不到，在文件开头添加（在标题后面）
      const titlePattern = /(# .+\n)/;
      const titleMatch = existingContent.match(titlePattern);
      if (titleMatch) {
        const titleIndex = titleMatch.index! + titleMatch[0].length;
        updateContent = `${existingContent.slice(0, titleIndex) + newRecord}\n${existingContent.slice(titleIndex)}`;
      } else {
        // 如果连标题都没有，直接添加到文件开头
        updateContent = `${newRecord}\n${existingContent}`;
      }
    }
  }
  //   更新最后更新时间
  updateContent = updateContent.replace(
    /(\*最后更新：).+(\*)/,
    `*最后更新：$1${new Date().toLocaleString('zh-CN')}$2`,
  );

  //   写入文件
  writeFileSync(changeLogpath, updateContent, 'utf-8');
  return changeLogpath;
}

/**
 *生成提交记录的MarkDown格式
 */

function generateCommitRecordMarkdown(record: CommitRecord): string {
  const { timestamp, branch, commitHash, message, changes, files } = record;
  return `###  ${message}
    **提交信息：**
    - **时间**:${timestamp}
    - **分支**:${branch}
    - **提交哈希**:${commitHash}
    
    **变更统计：**
    - **新增行数**:${changes.addedLines} 行
    - **删除行数**:${changes.deletedLines} 行
    - **修改文件：** ${changes.modifiedFiles} 个
    - **新增文件：** ${changes.addedFiles} 个
    - **删除文件：** ${changes.deletedFiles} 个
    - **文件类型：** ${files.fileTypes.join(', ')}
    - **复杂度 ** ${changes.complexity}
    - ** 变更样式：** ${changes.changePattern}
    - ** Friday分析:** ${changes.fridayAnalysis}
   
    **文件变更：**
    ${
      files.modified.length > 0
        ? `- **修改**: ${files.modified.map((f) => `\`${f}\``).join(', ')}`
        : ''
    }

    ${files.added.length > 0 ? `- **新增**: ${files.added.map((f) => `\`${f}\``).join(', ')}` : ''}
    ${files.deleted.length > 0 ? `- **删除**: ${files.deleted.map((f) => `\`${f}\``).join(', ')}` : ''}
  -----`;
}

/**
 * 获取当前的git信息
 */

export async function getGitInfo(): Promise<{ branch: string; commitHash: string }> {
  try {
    const { execSync } = await import('child_process');
    // 使用环境变量pwd作为工作目录，如果不存在则使用process.cwd()
    const gitRoot = process.env.PWD || process.cwd();

    console.log(`[DEBUG] getGitInfo - gitRoot: ${gitRoot}`);
    console.log(`[DEBUG] getGitInfo - PWD: ${process.env.PWD}`);
    console.log(`[DEBUG] getGitInfo - cwd: ${process.cwd()}`);

    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      cwd: gitRoot,
    }).trim();
    const commitHash = execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
      cwd: gitRoot,
    })
      .trim()
      .substring(0, 8);
    return { branch, commitHash };
  } catch (error) {
    throw new Error(`获取git信息失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 创建完整的提交记录
 */

export async function createCommitRecord(
  message: string,
  changes: CommitRecord['changes'],
  files: CommitRecord['files'],
): Promise<CommitRecord> {
  const { branch, commitHash } = await getGitInfo();
  const commitRecord: CommitRecord = {
    timestamp: new Date().toLocaleString('zh-CN'),
    branch,
    commitHash,
    message,
    changes,
    files,
  };
  return commitRecord;
}
