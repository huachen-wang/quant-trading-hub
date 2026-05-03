/** @type {const} */
const themeColors = {
  primary: { light: '#1E40AF', dark: '#3B82F6' }, // 深蓝/亮蓝 - 专业金融色
  background: { light: '#ffffff', dark: '#0A1628' }, // 白/深海蓝（v2: 比 0F172A 更深更高级）
  surface: { light: '#F8FAFC', dark: '#0F1E33' }, // 浅灰/卡面（v2: 配合新 background）
  foreground: { light: '#0F172A', dark: '#F4F6FB' }, // 深蓝灰/暖白（v2: 不用纯白避免刺眼）
  muted: { light: '#64748B', dark: '#A8B3C7' }, // 中灰/次要文本（v2: 更柔和）
  border: { light: '#E2E8F0', dark: '#64748B' },
  success: { light: '#10B981', dark: '#34D399' }, // 绿色 - 盈利
  warning: { light: '#F59E0B', dark: '#FBBF24' }, // 橙色 - 警告（保留鲜橙做警告语义）
  error: { light: '#EF4444', dark: '#F87171' }, // 红色 - 亏损
  accent: { light: '#C9A96E', dark: '#C9A96E' }, // 古金 - 品牌色（v2: 替代鲜金 #F59E0B/#FCD34D）
};

module.exports = { themeColors };
