import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { diff } from 'util';

interface GitDiffInfo {
  modifiedFiles: string[];
  addedLines: number;
  deletedLines: number;
  addedFiles: string[];
  deletedFiles: string[];
  diffContent: string;
}

/**
 * 获取git diff信息
 */

export function getGitDiff(): GitDiffInfo {
  try {
    // 使用环境变量pwd作为工作目录，如果不存在则使用process.cwd()
    const gitRoot = process.env.PWD || process.cwd();
    // 获取暂存区的变更
    const diffOutput = execSync('git diff --cached', {
      encoding: 'utf-8',
      cwd: gitRoot,
    });
    const statOutput = execSync('git diff --cached --stat', {
      encoding: 'utf-8',
      cwd: gitRoot,
    });
    //    解析统计信息
    const lines = statOutput.trim().split('\n');
    const lastLine = lines[lines.length - 1];

    // 新增行数和删除行数
    let addedLines = 0;
    let deletedLines = 0;

    if (lastLine.includes('insertion') || lastLine.includes('deletion')) {
      const match = lastLine.match(/(\d+) insertion?.*?(\d+) deletion?/);
      if (match) {
        addedLines = parseInt(match[1]);
        deletedLines = parseInt(match[2]);
      }
    }

    // 获取文件列表
    const modifiedFiles = execSync('git diff --cached --name-only', {
      encoding: 'utf-8',
      cwd: gitRoot,
    })
      .trim()
      .split('\n')
      .filter((file) => file.length > 0); // 过滤空行

    //   获取新增和删除文件
    const addedFiles = execSync('git diff --cache --name-status', {
      encoding: 'utf-8',
      cwd: gitRoot,
    })
      .trim()
      .split('\n')
      .filter((line) => line.startsWith('A'))
      .map((line) => line.substring(2));

    const deletedFiles = execSync('git diff --cache --name-status', {
      encoding: 'utf-8',
      cwd: gitRoot,
    })
      .trim()
      .split('\n')
      .filter((line) => line.startsWith('D'))
      .map((line) => line.substring(2));

    return {
      addedLines,
      deletedLines,
      modifiedFiles,
      addedFiles,
      deletedFiles,
      diffContent: diffOutput,
    };
  } catch (error) {
    throw new Error(`获取git diff失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 分析文件类型和变更模式
 */
export function analyzeFileChanges(diffInfo: GitDiffInfo): {
  fileTypes: string[];
  changePattern: string;
  complexity: 'low' | 'medium' | 'high';
} {
  const fileTypes = new Set<string>();
  let changePattern = '';
  let complexity: 'low' | 'medium' | 'high' = 'low';

  //   分析文件类型
  diffInfo.modifiedFiles.forEach((file) => {
    const ext = file.split('.').pop()?.toLowerCase();
    if (ext) {
      fileTypes.add(ext);
    }
  });

  //   分析变更模式
  const totalChanges = diffInfo.addedLines + diffInfo.deletedLines;

  const fileCount =
    diffInfo.modifiedFiles.length + diffInfo.addedFiles.length + diffInfo.deletedFiles.length;

  if (totalChanges > 500 || fileCount > 10) {
    complexity = 'high';
    changePattern = '大规模重构';
  } else if (totalChanges > 100 || fileCount > 5) {
    complexity = 'medium';
    changePattern = '中等规模修改';
  }
  return {
    fileTypes: Array.from(fileTypes),
    changePattern,
    complexity,
  };
}
