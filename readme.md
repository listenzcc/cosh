# 从 cosh 理解：二项分布的极限是正态分布（交互演示）

一个纯静态、零构建的交互式网页，把《从 cosh 理解二项分布的极限分布是正态分布》里的推导走一遍：
从抛硬币的二项分布出发，用双曲余弦 $\cosh$ 的矩母函数，直观看到标准化后
$\bigl[\cosh(t/\sqrt n)\bigr]^n \to e^{t^2/2}$（标准正态的矩母函数）。

## 内容模块

1. 抛硬币模拟：二项分布直方图 + 理论 PMF + 正态近似
2. 单次中心化试验的矩母函数 $\cosh(t/2)$ 与两支对称指数分解
3. 标准化矩母函数 $\bigl[\cosh(t/\sqrt n)\bigr]^n$ 收敛到 $e^{t^2/2}$（含动画）
4. $\ln\cosh x$ 的二次/四次近似，以及 $n\ln\cosh(t/\sqrt n)\to t^2/2$
5. 悬链线 $a\cosh(x/a)$ 与两支指数拆解
6. 一般成功概率 $p$ 下的标准化矩母函数收敛

## 本地预览

```bash
cd <项目目录>
python -m http.server 8000
# 浏览器打开 http://127.0.0.1:8000/
```

也可以直接双击 `index.html` 打开（公式依赖 MathJax CDN，需联网；图表为浏览器内实时计算，无外部数据）。

## 部署到 GitHub Pages

1. 在 GitHub 新建空仓库（不要勾选 README / license）。
2. 本地执行：
   ```bash
   git branch -M main
   git remote add origin https://github.com/<用户名>/<仓库名>.git
   git push -u origin main
   ```
3. 仓库 **Settings → Pages → Source** 选 `Deploy from a branch`，分支 `main`、目录 `/(root)`，保存。
4. 访问 `https://<用户名>.github.io/<仓库名>/`。

站点使用相对路径，放在项目子路径下也能正常加载。

## 目录结构

```
index.html              页面结构与公式（MathJax）
assets/css/style.css    样式
assets/js/app.js        交互逻辑与 Canvas 绘图
从 cosh 理解二项分布的极限分布是正态分布.md   原始文稿
```

## 技术说明

- 无框架、无打包步骤；原生 JS + Canvas，已做 DPR 高清适配与响应式。
- 公式通过 MathJax CDN 渲染；数值计算（二项 PMF、矩母函数）在浏览器内完成。
