const {createInterface} = require('readline');
const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const {
    getGitStatus, getGitDiff, analyzeFileChanges,
    generateCommitMessage
    
} = require('../dist/utils/gitAnalyzer.js')

const {
    updateChangelog, createCommitRecord
} = require('../dist/utils/readmeUpdater.js');
const { get } = require('http');
const { queryFridayRes } = require('../dist/axios/index.js');


// 创建交互界面
const rl = createInterface({
    input: process.stdin,
    output: process.stdout
})

// 询问用户确认的函数
function askQuestion(question){
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim().toLowerCase());
        });
    });
}


// 执行git命令函数
function executeGitCommand(command, description) {
    try {
        console.log("description:", `${description}..`)
        const result = execSync(command, { encoding: 'utf-8' });
        console.log("✅", `${description}成功.`);
        return { success: true, result };
    } catch (error) {
        console.error("❌", `${description}失败. ${error.message}`);
        return { success: false, error };
    }
}

/**
 * 解析命令行参数
 */

function parseArgs() {
    const args = process.argv.slice(2);
    return {
        updateChangeLog: args.includes("--changelog") || args.includes("-c"),
        noVerify: args.includes("--no-verify") || args.includes("-n"),
        help: args.includes("--help") || args.includes("-h"),
    }
}

/**
 * 显示帮助信息
 */

function showHelp() {
    console.log(`
Git Commit Analyzer 使用帮助:

命令行选项:
  --changelog, -c    更新README.md中的变更日志
  --no-verify, -n    跳过提交前的验证步骤
  --help, -h         显示此帮助信息

示例用法:
  node bin/git-commit-analyzer.js --changelog
  node bin/git-commit-analyzer.js -n
`);
}

// 主函数
async function autoCommit() {
    const options = parseArgs();
    if (options.help) {
        showHelp();
        return;
    }
    console.log("🚀 Git Commit Analyzer 智能提交工具\n");
    try{
        // 检查git状态
        const gitStatus=getGitStatus();
        if(!gitStatus.hasStagedChanges){
            console.log('没有检测到暂存的变更，正在自动添加所有变更...');
            const addResult=executeGitCommand('git add .', '添加变更到暂存区');
            if(!addResult.success){
               console.log('❌ 添加变更失败，请检查git状态')
               rl.close();
               return;
            }

            // 重新检查git状态
            const newGitStatus=getGitStatus();
            if(!newGitStatus.hasStagedChanges){
                console.log('❌ 没有检测到任何变更可以提交')
                rl.close();
                return;
            }
            console.log('✅ 所有变更已添加到暂存区');
        }

        console.log(`📝 当前分支: ${gitStatus.branch}`);
        console.log(`🔀 上次提交: ${gitStatus.lastCommit}\n`);

        // 分析变更
        console.log('🔍 正在分析变更...');
        const diffInfo=getGitDiff();
        const analysis=analyzeFileChanges(diffInfo);
        
        console.log('✅ 变更分析完成.\n');
        const commitAnalysis=generateCommitMessage(diffInfo,analysis);
        // 调用 Friday 分析
        const fridayAnalysis=await queryFridayRes(diffInfo.diffOutput || '');
        // 清理Friday分析结果，移除可能的调试信息
        const cleanFridayAnalysis=fridayAnalysis?fridayAnalysis.trim().split('\n')[0]: 'null';
        const commitMessage=cleanFridayAnalysis?`${commitAnalysis.suggestedMessage?.replace(/^[^:]+:\s*/, '')}\n\nFriday分析结果:\n${cleanFridayAnalysis}`:commitAnalysis.suggestedMessage;
        // 分析显示结果
        console.log("🧾 变更统计：");
        console.log(`  - 新增文件: ${diffInfo.addedFiles}行`);
        console.log(`  - 修改文件: ${diffInfo.modifiedFiles}行`);
        console.log(`  - 删除文件: ${diffInfo.deletedFiles}行\n`);
        console.log(` 文件：${diffInfo.modifiedFiles.length
            +diffInfo.addedFiles.length
            +diffInfo.deletedFiles.length}个\n`);
        // console.log("💡 建议的提交信息：");
        console.log(` 类型： ${analysis.changePattern}\n`);
        console.log(` 复杂度：${analysis.complexity}\n`); 
        // 显示建议的commit message
        console.log("💡 建议的提交信息：");
        console.log('-'.repeat(60));
        console.log(commitMessage);
        console.log('-'.repeat(60));
        console.log(`   Friday分析结果:${cleanFridayAnalysis}\n`);
        // 根据参数决定是否更新changelog
        if(options.updateChangeLog){
            console.log('📝 正在更新README.md中的变更日志...');
            try{
            const commitRecord=await createCommitRecord(commitMessage,{
                addedLines:diffInfo.addedLines,
                deletedLines:diffInfo.deletedLines,
                modifiedFiles:diffInfo.modifiedFiles.length,
                addedFiles:diffInfo.addedFiles.length,
                deletedFiles:diffInfo.deletedFiles.length,
                fileTypes:analysis.fileTypes,
                complexity:analysis.complexity,
                changePattern:analysis.changePattern,
                fridayAnalysis:cleanFridayAnalysis
            },{
                modified:diffInfo.modifiedFiles,
                added:diffInfo.addedFiles,
                deleted:diffInfo.deletedFiles
            });
            const changelogPath = updateChangelog(commitRecord);
            console.log(`✅ README.md中的变更日志已更新.${changelogPath}\n`);
            // 将changelog加入暂存区
            const addChangelogResult=executeGitCommand(`git add ${changelogPath}`, '将变更日志添加到暂存区');
            if(addChangelogResult.success){
                console.log('✅ 变更日志已添加到暂存区.\n');
            }else{
                console.log('❌ 变更日志添加到暂存区失败，请手动添加.\n');
            }
            }catch(e){
               console.log('❌ 更新变更日志时出错:', e.message);
            }
        }else{
            console.log("\n 📝 跳过changelog更新(使用 --changelog 参数启用)");
        }
        // 询问用户确认
        const confirm=await askQuestion('\n❓ 是否执行提交？(y/n/custom/edit):');
        // 在此执行下git add .
        const addResult=executeGitCommand('git add .', '添加变更到暂存区');
        if(!addResult.success){
           console.log('❌ 添加变更失败，请检查git状态')
           rl.close();
           return;
        }

        if(confirm==='y' || confirm==='yes'){
            // 执行提交
            const noVerifyFlag=options.noVerify?' --no-verify':'';
            const commitResult=executeGitCommand(`
                git commit${noVerifyFlag} -m "${commitMessage}"
                `,"执行git提交");
            if(commitResult.success){
                console.log('🎉 提交成功！');
            }
            // 询问是否推送
            const shouldPush=await askQuestion('❓ 是否推送到远程仓库？(y/n):');
            if(shouldPush==='y' || shouldPush==='yes'){
                const pushResult=executeGitCommand('git push', '推送到远程仓库');
                if(pushResult.success){
                    console.log('🚀 推送成功！');
                }
            }else{
                console.log('⚠️ 取消提交.');
            }
        }
    }catch(error){
        console.log('❌ 运行失败:', error.message);
        
    }finally{
        rl.close();
    }

    
}
autoCommit();