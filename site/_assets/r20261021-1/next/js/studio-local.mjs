// Local-only Studio additions. The captured editor and scene schema stay intact.
export const localGuideCopy = {
  intro: '跟着做完六关，你会做出一份敌人在地图里左右横移的训练场景，试玩后导出 JSON。建议把编辑器开在另一个标签页里，边看边做。',
  before: '需要有鼠标的电脑。本地编辑、保存、导入、导出和试玩不需要登录。',
  notice: '本地版支持编辑、试玩和 JSON 文件备份；不会上传、提交审核或发布到原站。',
  exportCard: '打开场景库菜单，选择「导出 JSON」。在另一台电脑的编辑器里选择「导入 JSON」即可继续编辑。',
  exportCaption: '保存 scene.json 文件后，重新导入并试玩，确认敌人、规则和出生点完整。',
};

export function adaptTutorialLevels(levels) {
  return levels.map(level => level.no === 6 ? {
    ...level,
    title: '导出与备份', sub: '保存、导入、继续编辑',
    goal: '把当前场景保存成 JSON 文件，之后可以换电脑继续编辑。文件包含场景内容，不包含地图和模型资源。',
    steps: [
      '先点「保存」，再打开顶栏的场景库菜单。',
      '选择「导出 JSON」，把文件保存在你能找到的位置。',
      '在编辑器中选择「导入 JSON」，打开刚才的文件。导入会进行场景检查。',
      '核对地图、敌人模板、生成器、出生点和规则，然后再试玩一次。',
    ],
    callouts: [{kind: 'warn', title: '本地文件备份', html: localGuideCopy.notice}],
    pass: '已下载 JSON 文件，重新导入后能够继续编辑和试玩。',
    deeper: [{id: 'save', label: '草稿、场景库与导入导出'}, {id: 'publish', label: '本地版与在线服务'}],
    pic: null,
  } : level);
}

const localChapters = {
  cloud: {title: '本地备份与换电脑', body: [
    ['文件备份', '场景库保存在当前浏览器里。换电脑、清理浏览器数据之前，请使用「导出 JSON」。'],
    ['恢复场景', '把文件复制到另一台电脑，打开编辑器后选择「导入 JSON」。地图和模型由本地服务器提供。'],
  ]},
  publish: {title: '本地版与在线服务', body: [
    ['本地编辑', localGuideCopy.notice],
    ['分享场景文件', '使用「导出 JSON」保存场景，对方可在兼容的编辑器里导入。导出不会产生公开链接、审核记录或原站排名。'],
  ]},
  review: {title: '导出前检查', body: [
    ['完整试玩', '检查出生点可以落地、敌人会正常出现、路线可以走完，并确认回合能够结束。'],
    ['核对规则', '检查时长、武器、血量归零后的行为和漏靶扣分。漏靶扣分必须是 1 到 5000 之间的整数。'],
  ]},
  update: {title: '保存场景的不同版本', body: [
    ['另存为', '要保留旧版，请先「另存为」一份，再修改副本。'],
    ['导出版本', '为不同版本保留各自的 JSON 文件。导入时核对场景名称和内容，避免覆盖需要保留的修改。'],
  ]},
  players: {title: '让其他人试玩', body: [
    ['交换 JSON 文件', '把导出的场景文件交给对方，在本地编辑器里导入后试玩。该文件不是地图、角色或武器资源包。'],
    ['原站在线服务', localGuideCopy.notice],
  ]},
};

export function adaptManualChapters(chapters) {
  return chapters.map(chapter => {
    const replacement = localChapters[chapter.id];
    if (replacement) {
      const headings = replacement.body.map(([text], i) => ({id: `${chapter.id}--${i}`, text}));
      return {...chapter, title: replacement.title,
        html: `<div class="sg-crumb">本地版</div><h1>${replacement.title}</h1>` +
          replacement.body.map(([title, text], i) => `<h2 id="${headings[i].id}">${title}</h2><p>${text}</p>`).join(''),
        headings};
    }
    let html = chapter.html;
    if (chapter.id === 'before') html = `<p class="sg-callout">${localGuideCopy.notice}</p>` + html;
    // Source online-only instructions remain documented upstream, not promised here.
    html = html.replace('自己试玩没问题，就能发布到玩家创意工坊给所有人玩。', '自己试玩后，可以导出 JSON 文件备份。')
      .replace('要带走：「上传到云端」，或者「导出 JSON」。', '要带走：使用「导出 JSON」。')
      .replace('回原来的电脑「上传到云端」，到新电脑「我的云端」里载入。已经发布的作品可以从「我的投稿」点「去编辑器更新」拿回来。', '回原来的电脑导出 JSON 文件，再在新电脑导入。');
    return {...chapter, html};
  });
}

export function explainLocalStudio(scope = globalThis) {
  const english = scope.document?.documentElement?.lang === 'en';
  scope.alert?.(english
    ? 'This local editor supports saving, importing, exporting JSON and playtesting. To back up or share a scene, choose Export JSON from the scene library menu. It does not upload or publish to ishoutu.cn.'
    : 'Trình tạo bài tập này hỗ trợ lưu, nhập/xuất JSON và chơi thử. Để sao lưu hoặc chia sẻ bài, chọn Xuất JSON trong thư viện bài tập. Nội dung không được tải lên hay đăng công khai trên ishoutu.cn.');
}
