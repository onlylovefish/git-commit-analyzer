import axios from 'axios';

export const openApi = axios.create({
  baseURL: 'https://aigc.sankuai.com',
  headers: {
    'Content-Type': 'application/json',
    Authorization: '',
  },
});

// 公司内部的friday接口
export async function conversationV2(message: any[]) {
  const { data } = await openApi.post('/aigc/api/v1/conversation/conversationV2', {
    messages: message,
  });
  return data;
}

export const queryFridayRes = async (gitDiffInfo: string) => {
  let ans = '';
  try {
    ans = await conversationV2([
      {
        role: 'system',
        content: `
                你是一个专业的 git commit message 生成助手，精通 Conventional Commits 规范。
                你的任务是根据用户提供的 git diff 信息，分析代码变更内容，准确理解本次提交的目的和影响。
                请严格按照以下要求生成 commit message：
                1. 只输出 commit message，不要输出多余解释。
                2. 内容简洁明了。
                3. type 建议从 feat、fix、docs、style、refactor、test、chore 中选择，必要时可加 scope。
                4. subject 需准确描述本次变更的核心内容，避免重复、模糊或无意义的描述。
                5. 如有必要，可在 body 补充说明变更动机、影响范围或 breaking change。
                6. 不要编造未在 diff 中体现的内容。
                7. 保持 message 语法和格式规范。
                
                下面是用户提供的 git diff 信息，请生成符合要求的 commit message：
                `,
      },
    ]);
  } catch (e) {
    // 捕获异常，返回空字符串或错误信息
    return '';
  }
};
