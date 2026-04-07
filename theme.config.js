/** @type {const} */
const themeColors = {
  primary: { light: '#1E40AF', dark: '#3B82F6' }, // 深蓝/亮蓝 - 专业金融色
  background: { light: '#ffffff', dark: '#0F172A' }, // 白/深蓝灰
  surface: { light: '#F8FAFC', dark: '#1E293B' }, // 浅灰/中蓝灰
  foreground: { light: '#0F172A', dark: '#FFFFFF' }, // 深蓝灰/纯白 - 确保主文字最亮
  muted: { light: '#64748B', dark: '#F1F5F9' }, // 中灰/slate-100 - 次要文字接近纯白确保手机可读
  border: { light: '#E2E8F0', dark: '#64748B' }, // 浅灰/slate-500 - 边框更明显
  success: { light: '#10B981', dark: '#34D399' }, // 绿色 - 盈利
  warning: { light: '#F59E0B', dark: '#FBBF24' }, // 橙色 - 警告
  error: { light: '#EF4444', dark: '#F87171' }, // 红色 - 亏损
  accent: { light: '#F59E0B', dark: '#FCD34D' }, // 金色 - 强调色
};

module.exports = { themeColors };
