import { readFileSync, writeFileSync, existsSync } from 'fs';

import { join } from 'path';
import { generateCommitMessage } from './gitAnalyzer';
import exp from 'constants';

interface CommitRecord {}

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
 * 生成提交记录的markdown格式
 * @param commitRecord
 */
export function generateCommitRecordMarkdown(commitRecord: CommitRecord): string {
  const { timetamp, branch, commitHash, message, changes, files } = commitRecord;
  return `###  ${message}`;
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
}
