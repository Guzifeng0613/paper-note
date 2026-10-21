# 自有代码全部保留：R8 只压缩/优化第三方(androidx)，避免误删桥接、Service、存储逻辑
-keep class com.zhipian.notes.** { *; }

# JS 桥接方法必须保留（被网页反射调用）
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# WebView 客户端相关
-keepclassmembers class * extends android.webkit.WebChromeClient { *; }
-keepclassmembers class * extends android.webkit.WebViewClient { *; }
-dontwarn org.json.**
