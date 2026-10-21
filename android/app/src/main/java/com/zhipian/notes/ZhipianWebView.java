package com.zhipian.notes;

import android.content.Context;
import android.util.AttributeSet;
import android.view.ActionMode;
import android.view.Menu;
import android.view.MenuItem;
import android.webkit.WebView;

/**
 * 屏蔽系统文本选择菜单（复制 / 粘贴 / 分享 / 全选），但完整保留选区与选择手柄。
 *
 * 不能直接让 startActionMode 返回 null —— 那样 ActionMode 建立失败，
 * WebView 会连带清除当前选区，表现为"文字刚选中就消失、无法编辑"。
 *
 * 做法：用一个包装回调，让系统 ActionMode 正常建立（原始回调完整参与
 * 生命周期、mode 引用保持一致），但在其填充完菜单后立即 menu.clear()，
 * 于是浮动栏没有任何系统项；格式化由应用自己的浮层承担。
 */
public class ZhipianWebView extends WebView {
    /**
     * 是否屏蔽系统选择菜单。仅在正文 contenteditable 内选中文字时为 true；
     * 在普通输入框（标题 / 待办 / SecretKey / 授权码等）为 false，
     * 以保留长按"粘贴"等系统能力。由 JS 在 focus / blur 正文时切换。
     */
    public boolean suppressActionMenu = false;

    public ZhipianWebView(Context c) { super(c); }
    public ZhipianWebView(Context c, AttributeSet a) { super(c, a); }
    public ZhipianWebView(Context c, AttributeSet a, int style) { super(c, a, style); }

    private ActionMode.Callback wrap(final ActionMode.Callback orig) {
        return new ActionMode.Callback() {
            @Override
            public boolean onCreateActionMode(ActionMode mode, Menu menu) {
                boolean r = true;
                try { r = orig.onCreateActionMode(mode, menu); } catch (Exception ignore) {}
                menu.clear();  // 移除复制 / 粘贴 / 分享 / 全选
                return true;   // 必须建立模式，选区才不会被取消
            }
            @Override
            public boolean onPrepareActionMode(ActionMode mode, Menu menu) {
                try { orig.onPrepareActionMode(mode, menu); } catch (Exception ignore) {}
                menu.clear();  // 拖动手柄会重新填充，需再次清空
                return true;
            }
            @Override
            public boolean onActionItemClicked(ActionMode mode, MenuItem item) {
                return false;
            }
            @Override
            public void onDestroyActionMode(ActionMode mode) {
                try { orig.onDestroyActionMode(mode); } catch (Exception ignore) {}
            }
        };
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback) {
        return suppressActionMenu
                ? super.startActionMode(wrap(callback))
                : super.startActionMode(callback);
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback, int type) {
        return suppressActionMenu
                ? super.startActionMode(wrap(callback), type)
                : super.startActionMode(callback, type);
    }
}
