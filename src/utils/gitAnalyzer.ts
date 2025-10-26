import { execSync } from 'child_process';

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
    const addedFiles = execSync('git diff --cached --name-status', {
      encoding: 'utf-8',
      cwd: gitRoot,
    })
      .trim()
      .split('\n')
      .filter((line) => line.startsWith('A'))
      .map((line) => line.substring(2));

    const deletedFiles = execSync('git diff --cached --name-status', {
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

//
export function generateCommitMessage(diffInfo: GitDiffInfo, analysis: any) {
  const { fileTypes, changePattern, complexity } = analysis;

  let type = 'chore';
  let scope: string | undefined;
  let description = '';
  let body = '';
  let breakingChanges = false;
  // 根据文件类型和变更模式确定commit类型
  if (diffInfo.addedFiles.length > 0 && diffInfo.addedFiles.some((file) => file.includes('test'))) {
    type = 'test';
    description = '添加测试文件';
  } else if (fileTypes.includes('md') || fileTypes.includes('txt')) {
    type = 'docs';
    description = '更新文档';
  } else if (fileTypes.includes('css') || fileTypes.includes('scss')) {
    type = 'style';
    description = '调整样式';
  } else if (changePattern.includes('重构')) {
    type = 'refactor';
    description = '重构代码';
  } else if (diffInfo.deletedFiles.length > 0) {
    type = 'chore';
    description = '删除文件';
  } else if (diffInfo.addedFiles.length > 0) {
    type = 'feat';
    description = '新增功能';
  } else if (diffInfo.modifiedFiles.length > 0) {
    // 分析修改内容
    const modify =
      diffInfo.diffContent.includes('fix') ||
      diffInfo.diffContent.includes('bug') ||
      diffInfo.diffContent.includes('error');

    if (modify) {
      type = 'fix';
      description = '修复问题';
    } else {
      type = 'feat';
      description = '功能更新';
    }
  }

  // 确定scope
  if (diffInfo.modifiedFiles.length > 0) {
    const mainFile = diffInfo.modifiedFiles[0];
    if (mainFile.includes('/')) {
      scope = mainFile.split('/')[0];
    } else {
      scope = mainFile.split('.')[0];
    }
  }

  //  生成描述
  if (diffInfo.addedFiles.length > 0) {
    description += `: 新增${diffInfo.addedFiles.length}个文件`;
  }

  if (diffInfo.modifiedFiles.length > 0) {
    description += `: 修改${diffInfo.modifiedFiles.length}个文件`;
  }
  if (diffInfo.deletedFiles.length > 0) {
    description += `: 删除${diffInfo.deletedFiles.length}个文件`;
  }

  // 生成body
  if (complexity === 'high') {
  } else if (complexity === 'medium') {
  }

  //   检查是否有破坏性变更
  if (
    diffInfo.diffContent.includes('BREAKING CHANGE') ||
    diffInfo.diffContent.includes('breaking change')
  ) {
    breakingChanges = true;
  }

  // 生成完整的commit message
  let suggestedMessage = `${type}`;
  if (scope) {
    suggestedMessage += `(${scope})`;
  }
  suggestedMessage += `: ${description}`;
  if (breakingChanges) {
    suggestedMessage += '!';
  }
  //   添加变更统计信息到commit message
  const statsInfo =
    '\n\n变更统计信息:\n' +
    `- 新增行数: ${diffInfo.addedLines}\n` +
    `- 删除行数: ${diffInfo.deletedLines}\n` +
    `- 修改文件数: ${diffInfo.modifiedFiles.length}\n` +
    `- 新增文件数: ${diffInfo.addedFiles.length}\n` +
    `- 删除文件数: ${diffInfo.deletedFiles.length}\n` +
    `- 变更复杂度: ${complexity}\n` +
    `- 涉及文件类型: ${fileTypes.join(', ')}\n`;

  if (body) {
    suggestedMessage += `\n\n${body}`;
  }
  suggestedMessage += statsInfo;

  return { type, suggestedMessage, scope, description, body, breakingChanges };
}

/**
 * 获取git状态信息
 */

export function getGitStatus(): {
  hasStagedChanges: boolean;
  hasUnstagedChanges: boolean;
  branch: string;
  lastCommit: string;
} {
  try {
    // 使用环境变量pwd作为工作目录，如果不存在则使用process.cwd()
    const gitRoot = process.env.PWD || process.cwd();
    const hasStagedChanges =
      execSync('git diff --cached --quiet;echo $? ', {
        encoding: 'utf-8',
        cwd: gitRoot,
      }).trim() === '1';
    const hasUnstagedChanges =
      execSync('git diff --quiet;echo $? ', {
        encoding: 'utf-8',
        cwd: gitRoot,
      }).trim() === '1';
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      cwd: gitRoot,
    }).trim();
    const lastCommit = execSync('git log -1 --pretty=format:%h', {
      encoding: 'utf-8',
      cwd: gitRoot,
    }).trim();
    return { hasStagedChanges, hasUnstagedChanges, branch, lastCommit };
  } catch (e) {
    throw new Error(`获取git状态失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}
