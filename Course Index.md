---
type: index
status: generated
generator: "lecture-graph"
tags: [index]
cssclasses: ["lg-index"]
---

# 📚 Оглавление курса · Course Index

9 глав · 36 секций · 216 заголовков · 756 блоков · 8508 ссылок в графе · 1017 вершин
*пересобрано: 2026-09-11 11:07*

> [!tip]- как пользоваться оглавлением
> 🟡 глава · 🔵 секция · 🟢 заголовок · 🟣 блоки — у каждого уровня своя цветная полоска слева,
>  цвета совпадают с цветом этих вершин в графе;
> - каждая строка — ссылка на заметку; `⇠ N` — сколько текстов на неё ссылаются,
>   из этого же числа плагин считает размер вершины в графе;
> - `∑` — в блоке есть вынесенная формула `$$…$$`, `◌` — текст пока заглушка (`status: placeholder`);
> - сами полоски рисует сниппет `lecture-nodes.css` селектором `.lg-index`: без него блоки останутся
>   серыми, содержимое и ссылки не пострадают;
> - стрелка у заголовка сворачивает весь блок — главу, секцию или группу заголовков;
> - про сами графы, фильтры и экспорт: [[02 Graph — как читать и править]]
> - пересобрать страницу: `Ctrl+P → Lecture Graph: Regenerate course index`.

## Указатель глав

| # | глава | 中文 | секции | заголовки | блоки | `⇠` |
|--:|---|---|--:|--:|--:|--:|
| 1 | [[#Ch01 · Metric Spaces and Completion]] | 度量空间与完备化 | 4 | 24 | 84 | `160` |
| 2 | [[#Ch02 · Normed Spaces and Operators]] | 赋范空间与算子 | 4 | 24 | 84 | `145` |
| 3 | [[#Ch03 · Inner Products and Orthogonality]] | 内积与正交性 | 4 | 24 | 84 | `148` |
| 4 | [[#Ch04 · Banach Space Theorems]] | 巴拿赫空间定理 | 4 | 24 | 84 | `138` |
| 5 | [[#Ch05 · Hilbert Space Geometry]] | 希尔伯特空间几何 | 4 | 24 | 84 | `155` |
| 6 | [[#Ch06 · Spectral Theory]] | 谱理论 | 4 | 24 | 84 | `67` |
| 7 | [[#Ch07 · Convexity and Duality]] | 凸性与对偶性 | 4 | 24 | 84 | `62` |
| 8 | [[#Ch08 · Concentration and Probability]] | 集中性与概率 | 4 | 24 | 84 | `46` |
| 9 | [[#Ch09 · Learning Theory and Regularization]] | 学习理论与正则化 | 4 | 24 | 84 | `68` |

---

## Ch01 · Metric Spaces and Completion

> [!chapter]+ 🟡 *度量空间与完备化* · [[Ch01 - Metric Spaces and Completion|Metric Spaces and Completion]] · `160` · исходящих `5`
>
> > [!section]+ 🔵 `Ch01-S01` · [[Ch01-S01 - Setup and Notation|Setup and Notation — Metric Spaces and Completion]] · 度量空间与完备化：预备知识与记号 · `⇠ 70` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S01-H01 - Definition Vector Space|Definition: Vector Space]] · 向量空间：定义 · `⇠ 66` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch01-S01-H01-B01 - Proposition 1.1.1a|Vector Space Proposition 1.1.1a]] · 向量空间命题 1.1.1a · `⇠ 69` · `∑` · `◌`
> > > > - [[Ch01-S01-H01-B02 - Identity 1.1.1b|Vector Space Identity 1.1.1b]] · 向量空间恒等式 1.1.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch01-S01-H01-B03 - Estimate 1.1.1c|Vector Space Estimate 1.1.1c]] · 向量空间估计 1.1.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S01-H01-B04 - Example 1.1.1d|Vector Space Example 1.1.1d]] · 向量空间例子 1.1.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S01-H02 - Notation Linear Operator|Notation: Linear Operator]] · 线性算子：记号约定 · `⇠ 33` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch01-S01-H02-B01 - Identity 1.1.2a|Linear Operator Identity 1.1.2a]] · 线性算子恒等式 1.1.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch01-S01-H02-B02 - Estimate 1.1.2b|Linear Operator Estimate 1.1.2b]] · 线性算子估计 1.1.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S01-H02-B03 - Example 1.1.2c|Linear Operator Example 1.1.2c]] · 线性算子例子 1.1.2c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S01-H03 - Basic Properties Compact Set|Basic Properties: Compact Set]] · 紧集：基本性质 · `⇠ 40` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch01-S01-H03-B01 - Estimate 1.1.3a|Compact Set Estimate 1.1.3a]] · 紧集估计 1.1.3a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch01-S01-H03-B02 - Example 1.1.3b|Compact Set Example 1.1.3b]] · 紧集例子 1.1.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S01-H03-B03 - Proposition 1.1.3c|Compact Set Proposition 1.1.3c]] · 紧集命题 1.1.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch01-S01-H03-B04 - Identity 1.1.3d|Compact Set Identity 1.1.3d]] · 紧集恒等式 1.1.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S01-H04 - Key Lemma Metric Completion|Key Lemma: Metric Completion]] · 度量完备化：关键引理 · `⇠ 28` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch01-S01-H04-B01 - Example 1.1.4a|Metric Completion Example 1.1.4a]] · 度量完备化例子 1.1.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch01-S01-H04-B02 - Proposition 1.1.4b|Metric Completion Proposition 1.1.4b]] · 度量完备化命题 1.1.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch01-S01-H04-B03 - Identity 1.1.4c|Metric Completion Identity 1.1.4c]] · 度量完备化恒等式 1.1.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S01-H05 - Main Theorem Orthogonal Projection|Main Theorem: Orthogonal Projection]] · 正交投影：主定理 · `⇠ 38` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch01-S01-H05-B01 - Proposition 1.1.5a|Orthogonal Projection Proposition 1.1.5a]] · 正交投影命题 1.1.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch01-S01-H05-B02 - Identity 1.1.5b|Orthogonal Projection Identity 1.1.5b]] · 正交投影恒等式 1.1.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch01-S01-H05-B03 - Estimate 1.1.5c|Orthogonal Projection Estimate 1.1.5c]] · 正交投影估计 1.1.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch01-S01-H05-B04 - Example 1.1.5d|Orthogonal Projection Example 1.1.5d]] · 正交投影例子 1.1.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S01-H06 - Proof and Consequences Basis and Coordinates|Proof and Consequences: Basis and Coordinates]] · 基与坐标：证明与推论 · `⇠ 30` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch01-S01-H06-B01 - Identity 1.1.6a|Basis and Coordinates Identity 1.1.6a]] · 基与坐标恒等式 1.1.6a · `⇠ 11` · `∑` · `◌`
> > > > - [[Ch01-S01-H06-B02 - Estimate 1.1.6b|Basis and Coordinates Estimate 1.1.6b]] · 基与坐标估计 1.1.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch01-S01-H06-B03 - Example 1.1.6c|Basis and Coordinates Example 1.1.6c]] · 基与坐标例子 1.1.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch01-S02` · [[Ch01-S02 - Core Theory|Core Theory — Metric Spaces and Completion]] · 度量空间与完备化：核心理论 · `⇠ 52` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S02-H01 - Definition Dual Space|Definition: Dual Space]] · 对偶空间：定义 · `⇠ 53` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch01-S02-H01-B01 - Proposition 1.2.1a|Dual Space Proposition 1.2.1a]] · 对偶空间命题 1.2.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch01-S02-H01-B02 - Identity 1.2.1b|Dual Space Identity 1.2.1b]] · 对偶空间恒等式 1.2.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S02-H01-B03 - Estimate 1.2.1c|Dual Space Estimate 1.2.1c]] · 对偶空间估计 1.2.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch01-S02-H01-B04 - Example 1.2.1d|Dual Space Example 1.2.1d]] · 对偶空间例子 1.2.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S02-H02 - Notation Adjoint Operator|Notation: Adjoint Operator]] · 伴随算子：记号约定 · `⇠ 21` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch01-S02-H02-B01 - Identity 1.2.2a|Adjoint Operator Identity 1.2.2a]] · 伴随算子恒等式 1.2.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch01-S02-H02-B02 - Estimate 1.2.2b|Adjoint Operator Estimate 1.2.2b]] · 伴随算子估计 1.2.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch01-S02-H02-B03 - Example 1.2.2c|Adjoint Operator Example 1.2.2c]] · 伴随算子例子 1.2.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S02-H03 - Basic Properties Spectral Theorem|Basic Properties: Spectral Theorem]] · 谱定理：基本性质 · `⇠ 37` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch01-S02-H03-B01 - Estimate 1.2.3a|Spectral Theorem Estimate 1.2.3a]] · 谱定理估计 1.2.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch01-S02-H03-B02 - Example 1.2.3b|Spectral Theorem Example 1.2.3b]] · 谱定理例子 1.2.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch01-S02-H03-B03 - Proposition 1.2.3c|Spectral Theorem Proposition 1.2.3c]] · 谱定理命题 1.2.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S02-H03-B04 - Identity 1.2.3d|Spectral Theorem Identity 1.2.3d]] · 谱定理恒等式 1.2.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S02-H04 - Key Lemma Norm Equivalence|Key Lemma: Norm Equivalence]] · 范数等价：关键引理 · `⇠ 46` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch01-S02-H04-B01 - Example 1.2.4a|Norm Equivalence Example 1.2.4a]] · 范数等价例子 1.2.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch01-S02-H04-B02 - Proposition 1.2.4b|Norm Equivalence Proposition 1.2.4b]] · 范数等价命题 1.2.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch01-S02-H04-B03 - Identity 1.2.4c|Norm Equivalence Identity 1.2.4c]] · 范数等价恒等式 1.2.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S02-H05 - Main Theorem Contraction Mapping|Main Theorem: Contraction Mapping]] · 压缩映射：主定理 · `⇠ 50` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch01-S02-H05-B01 - Proposition 1.2.5a|Contraction Mapping Proposition 1.2.5a]] · 压缩映射命题 1.2.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch01-S02-H05-B02 - Identity 1.2.5b|Contraction Mapping Identity 1.2.5b]] · 压缩映射恒等式 1.2.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S02-H05-B03 - Estimate 1.2.5c|Contraction Mapping Estimate 1.2.5c]] · 压缩映射估计 1.2.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S02-H05-B04 - Example 1.2.5d|Contraction Mapping Example 1.2.5d]] · 压缩映射例子 1.2.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S02-H06 - Proof and Consequences Fixed Point|Proof and Consequences: Fixed Point]] · 不动点：证明与推论 · `⇠ 36` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch01-S02-H06-B01 - Identity 1.2.6a|Fixed Point Identity 1.2.6a]] · 不动点恒等式 1.2.6a · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S02-H06-B02 - Estimate 1.2.6b|Fixed Point Estimate 1.2.6b]] · 不动点估计 1.2.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S02-H06-B03 - Example 1.2.6c|Fixed Point Example 1.2.6c]] · 不动点例子 1.2.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch01-S03` · [[Ch01-S03 - Main Results|Main Results — Metric Spaces and Completion]] · 度量空间与完备化：主要结果 · `⇠ 33` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S03-H01 - Definition Banach Limit|Definition: Banach Limit]] · 巴拿赫极限：定义 · `⇠ 44` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch01-S03-H01-B01 - Proposition 1.3.1a|Banach Limit Proposition 1.3.1a]] · 巴拿赫极限命题 1.3.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch01-S03-H01-B02 - Identity 1.3.1b|Banach Limit Identity 1.3.1b]] · 巴拿赫极限恒等式 1.3.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch01-S03-H01-B03 - Estimate 1.3.1c|Banach Limit Estimate 1.3.1c]] · 巴拿赫极限估计 1.3.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S03-H01-B04 - Example 1.3.1d|Banach Limit Example 1.3.1d]] · 巴拿赫极限例子 1.3.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S03-H02 - Notation Hilbert Decomposition|Notation: Hilbert Decomposition]] · 希尔伯特分解：记号约定 · `⇠ 27` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch01-S03-H02-B01 - Identity 1.3.2a|Hilbert Decomposition Identity 1.3.2a]] · 希尔伯特分解恒等式 1.3.2a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch01-S03-H02-B02 - Estimate 1.3.2b|Hilbert Decomposition Estimate 1.3.2b]] · 希尔伯特分解估计 1.3.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S03-H02-B03 - Example 1.3.2c|Hilbert Decomposition Example 1.3.2c]] · 希尔伯特分解例子 1.3.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S03-H03 - Basic Properties Weak Convergence|Basic Properties: Weak Convergence]] · 弱收敛：基本性质 · `⇠ 28` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch01-S03-H03-B01 - Estimate 1.3.3a|Weak Convergence Estimate 1.3.3a]] · 弱收敛估计 1.3.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch01-S03-H03-B02 - Example 1.3.3b|Weak Convergence Example 1.3.3b]] · 弱收敛例子 1.3.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S03-H03-B03 - Proposition 1.3.3c|Weak Convergence Proposition 1.3.3c]] · 弱收敛命题 1.3.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S03-H03-B04 - Identity 1.3.3d|Weak Convergence Identity 1.3.3d]] · 弱收敛恒等式 1.3.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S03-H04 - Key Lemma Density Argument|Key Lemma: Density Argument]] · 稠密性论证：关键引理 · `⇠ 40` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch01-S03-H04-B01 - Example 1.3.4a|Density Argument Example 1.3.4a]] · 稠密性论证例子 1.3.4a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch01-S03-H04-B02 - Proposition 1.3.4b|Density Argument Proposition 1.3.4b]] · 稠密性论证命题 1.3.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch01-S03-H04-B03 - Identity 1.3.4c|Density Argument Identity 1.3.4c]] · 稠密性论证恒等式 1.3.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S03-H05 - Main Theorem Kernel and Range|Main Theorem: Kernel and Range]] · 核与值域：主定理 · `⇠ 17` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch01-S03-H05-B01 - Proposition 1.3.5a|Kernel and Range Proposition 1.3.5a]] · 核与值域命题 1.3.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch01-S03-H05-B02 - Identity 1.3.5b|Kernel and Range Identity 1.3.5b]] · 核与值域恒等式 1.3.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S03-H05-B03 - Estimate 1.3.5c|Kernel and Range Estimate 1.3.5c]] · 核与值域估计 1.3.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch01-S03-H05-B04 - Example 1.3.5d|Kernel and Range Example 1.3.5d]] · 核与值域例子 1.3.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S03-H06 - Proof and Consequences Eigenvalue Bounds|Proof and Consequences: Eigenvalue Bounds]] · 特征值估计：证明与推论 · `⇠ 36` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch01-S03-H06-B01 - Identity 1.3.6a|Eigenvalue Bounds Identity 1.3.6a]] · 特征值估计恒等式 1.3.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch01-S03-H06-B02 - Estimate 1.3.6b|Eigenvalue Bounds Estimate 1.3.6b]] · 特征值估计估计 1.3.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch01-S03-H06-B03 - Example 1.3.6c|Eigenvalue Bounds Example 1.3.6c]] · 特征值估计例子 1.3.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch01-S04` · [[Ch01-S04 - Applications and Limits|Applications and Limits — Metric Spaces and Completion]] · 度量空间与完备化：应用与局限 · `⇠ 32` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S04-H01 - Definition Singular Values|Definition: Singular Values]] · 奇异值：定义 · `⇠ 51` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch01-S04-H01-B01 - Proposition 1.4.1a|Singular Values Proposition 1.4.1a]] · 奇异值命题 1.4.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch01-S04-H01-B02 - Identity 1.4.1b|Singular Values Identity 1.4.1b]] · 奇异值恒等式 1.4.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S04-H01-B03 - Estimate 1.4.1c|Singular Values Estimate 1.4.1c]] · 奇异值估计 1.4.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch01-S04-H01-B04 - Example 1.4.1d|Singular Values Example 1.4.1d]] · 奇异值例子 1.4.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S04-H02 - Notation Trace Class|Notation: Trace Class]] · 迹类：记号约定 · `⇠ 18` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch01-S04-H02-B01 - Identity 1.4.2a|Trace Class Identity 1.4.2a]] · 迹类恒等式 1.4.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch01-S04-H02-B02 - Estimate 1.4.2b|Trace Class Estimate 1.4.2b]] · 迹类估计 1.4.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch01-S04-H02-B03 - Example 1.4.2c|Trace Class Example 1.4.2c]] · 迹类例子 1.4.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S04-H03 - Basic Properties Convex Hull|Basic Properties: Convex Hull]] · 凸包：基本性质 · `⇠ 25` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch01-S04-H03-B01 - Estimate 1.4.3a|Convex Hull Estimate 1.4.3a]] · 凸包估计 1.4.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch01-S04-H03-B02 - Example 1.4.3b|Convex Hull Example 1.4.3b]] · 凸包例子 1.4.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch01-S04-H03-B03 - Proposition 1.4.3c|Convex Hull Proposition 1.4.3c]] · 凸包命题 1.4.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch01-S04-H03-B04 - Identity 1.4.3d|Convex Hull Identity 1.4.3d]] · 凸包恒等式 1.4.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S04-H04 - Key Lemma Separation Theorem|Key Lemma: Separation Theorem]] · 分离定理：关键引理 · `⇠ 19` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch01-S04-H04-B01 - Example 1.4.4a|Separation Theorem Example 1.4.4a]] · 分离定理例子 1.4.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch01-S04-H04-B02 - Proposition 1.4.4b|Separation Theorem Proposition 1.4.4b]] · 分离定理命题 1.4.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch01-S04-H04-B03 - Identity 1.4.4c|Separation Theorem Identity 1.4.4c]] · 分离定理恒等式 1.4.4c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S04-H05 - Main Theorem Hahn-Banach Extension|Main Theorem: Hahn-Banach Extension]] · 哈恩-巴拿赫延拓：主定理 · `⇠ 38` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch01-S04-H05-B01 - Proposition 1.4.5a|Hahn-Banach Extension Proposition 1.4.5a]] · 哈恩-巴拿赫延拓命题 1.4.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch01-S04-H05-B02 - Identity 1.4.5b|Hahn-Banach Extension Identity 1.4.5b]] · 哈恩-巴拿赫延拓恒等式 1.4.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch01-S04-H05-B03 - Estimate 1.4.5c|Hahn-Banach Extension Estimate 1.4.5c]] · 哈恩-巴拿赫延拓估计 1.4.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S04-H05-B04 - Example 1.4.5d|Hahn-Banach Extension Example 1.4.5d]] · 哈恩-巴拿赫延拓例子 1.4.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch01-S04-H06 - Proof and Consequences Open Mapping|Proof and Consequences: Open Mapping]] · 开映射：证明与推论 · `⇠ 21` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch01-S04-H06-B01 - Identity 1.4.6a|Open Mapping Identity 1.4.6a]] · 开映射恒等式 1.4.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch01-S04-H06-B02 - Estimate 1.4.6b|Open Mapping Estimate 1.4.6b]] · 开映射估计 1.4.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch01-S04-H06-B03 - Example 1.4.6c|Open Mapping Example 1.4.6c]] · 开映射例子 1.4.6c · `⇠ 3` · `∑` · `◌`

## Ch02 · Normed Spaces and Operators

> [!chapter]+ 🟡 *赋范空间与算子* · [[Ch02 - Normed Spaces and Operators|Normed Spaces and Operators]] · `145` · исходящих `5`
>
> > [!section]+ 🔵 `Ch02-S01` · [[Ch02-S01 - Setup and Notation|Setup and Notation — Normed Spaces and Operators]] · 赋范空间与算子：预备知识与记号 · `⇠ 37` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S01-H01 - Definition Closed Graph|Definition: Closed Graph]] · 闭图像：定义 · `⇠ 41` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch02-S01-H01-B01 - Proposition 2.1.1a|Closed Graph Proposition 2.1.1a]] · 闭图像命题 2.1.1a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch02-S01-H01-B02 - Identity 2.1.1b|Closed Graph Identity 2.1.1b]] · 闭图像恒等式 2.1.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch02-S01-H01-B03 - Estimate 2.1.1c|Closed Graph Estimate 2.1.1c]] · 闭图像估计 2.1.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S01-H01-B04 - Example 2.1.1d|Closed Graph Example 2.1.1d]] · 闭图像例子 2.1.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S01-H02 - Notation Uniform Boundedness|Notation: Uniform Boundedness]] · 一致有界性：记号约定 · `⇠ 33` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch02-S01-H02-B01 - Identity 2.1.2a|Uniform Boundedness Identity 2.1.2a]] · 一致有界性恒等式 2.1.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch02-S01-H02-B02 - Estimate 2.1.2b|Uniform Boundedness Estimate 2.1.2b]] · 一致有界性估计 2.1.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S01-H02-B03 - Example 2.1.2c|Uniform Boundedness Example 2.1.2c]] · 一致有界性例子 2.1.2c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S01-H03 - Basic Properties Approximation Error|Basic Properties: Approximation Error]] · 逼近误差：基本性质 · `⇠ 46` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch02-S01-H03-B01 - Estimate 2.1.3a|Approximation Error Estimate 2.1.3a]] · 逼近误差估计 2.1.3a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch02-S01-H03-B02 - Example 2.1.3b|Approximation Error Example 2.1.3b]] · 逼近误差例子 2.1.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S01-H03-B03 - Proposition 2.1.3c|Approximation Error Proposition 2.1.3c]] · 逼近误差命题 2.1.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch02-S01-H03-B04 - Identity 2.1.3d|Approximation Error Identity 2.1.3d]] · 逼近误差恒等式 2.1.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S01-H04 - Key Lemma Radon-Nikodym Derivative|Key Lemma: Radon-Nikodym Derivative]] · 拉东-尼科迪姆导数：关键引理 · `⇠ 28` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch02-S01-H04-B01 - Example 2.1.4a|Radon-Nikodym Derivative Example 2.1.4a]] · 拉东-尼科迪姆导数例子 2.1.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch02-S01-H04-B02 - Proposition 2.1.4b|Radon-Nikodym Derivative Proposition 2.1.4b]] · 拉东-尼科迪姆导数命题 2.1.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch02-S01-H04-B03 - Identity 2.1.4c|Radon-Nikodym Derivative Identity 2.1.4c]] · 拉东-尼科迪姆导数恒等式 2.1.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S01-H05 - Main Theorem Entropy Bound|Main Theorem: Entropy Bound]] · 熵界：主定理 · `⇠ 50` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch02-S01-H05-B01 - Proposition 2.1.5a|Entropy Bound Proposition 2.1.5a]] · 熵界命题 2.1.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch02-S01-H05-B02 - Identity 2.1.5b|Entropy Bound Identity 2.1.5b]] · 熵界恒等式 2.1.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch02-S01-H05-B03 - Estimate 2.1.5c|Entropy Bound Estimate 2.1.5c]] · 熵界估计 2.1.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch02-S01-H05-B04 - Example 2.1.5d|Entropy Bound Example 2.1.5d]] · 熵界例子 2.1.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S01-H06 - Proof and Consequences Concentration Inequality|Proof and Consequences: Concentration Inequality]] · 集中不等式：证明与推论 · `⇠ 27` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch02-S01-H06-B01 - Identity 2.1.6a|Concentration Inequality Identity 2.1.6a]] · 集中不等式恒等式 2.1.6a · `⇠ 11` · `∑` · `◌`
> > > > - [[Ch02-S01-H06-B02 - Estimate 2.1.6b|Concentration Inequality Estimate 2.1.6b]] · 集中不等式估计 2.1.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch02-S01-H06-B03 - Example 2.1.6c|Concentration Inequality Example 2.1.6c]] · 集中不等式例子 2.1.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch02-S02` · [[Ch02-S02 - Core Theory|Core Theory — Normed Spaces and Operators]] · 赋范空间与算子：核心理论 · `⇠ 30` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S02-H01 - Definition Gradient Descent|Definition: Gradient Descent]] · 梯度下降：定义 · `⇠ 49` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch02-S02-H01-B01 - Proposition 2.2.1a|Gradient Descent Proposition 2.2.1a]] · 梯度下降命题 2.2.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch02-S02-H01-B02 - Identity 2.2.1b|Gradient Descent Identity 2.2.1b]] · 梯度下降恒等式 2.2.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S02-H01-B03 - Estimate 2.2.1c|Gradient Descent Estimate 2.2.1c]] · 梯度下降估计 2.2.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch02-S02-H01-B04 - Example 2.2.1d|Gradient Descent Example 2.2.1d]] · 梯度下降例子 2.2.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S02-H02 - Notation Lipschitz Continuity|Notation: Lipschitz Continuity]] · 利普希茨连续性：记号约定 · `⇠ 33` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch02-S02-H02-B01 - Identity 2.2.2a|Lipschitz Continuity Identity 2.2.2a]] · 利普希茨连续性恒等式 2.2.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch02-S02-H02-B02 - Estimate 2.2.2b|Lipschitz Continuity Estimate 2.2.2b]] · 利普希茨连续性估计 2.2.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch02-S02-H02-B03 - Example 2.2.2c|Lipschitz Continuity Example 2.2.2c]] · 利普希茨连续性例子 2.2.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S02-H03 - Basic Properties Duality Gap|Basic Properties: Duality Gap]] · 对偶间隙：基本性质 · `⇠ 25` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch02-S02-H03-B01 - Estimate 2.2.3a|Duality Gap Estimate 2.2.3a]] · 对偶间隙估计 2.2.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch02-S02-H03-B02 - Example 2.2.3b|Duality Gap Example 2.2.3b]] · 对偶间隙例子 2.2.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch02-S02-H03-B03 - Proposition 2.2.3c|Duality Gap Proposition 2.2.3c]] · 对偶间隙命题 2.2.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S02-H03-B04 - Identity 2.2.3d|Duality Gap Identity 2.2.3d]] · 对偶间隙恒等式 2.2.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S02-H04 - Key Lemma Regularization|Key Lemma: Regularization]] · 正则化：关键引理 · `⇠ 28` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch02-S02-H04-B01 - Example 2.2.4a|Regularization Example 2.2.4a]] · 正则化例子 2.2.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch02-S02-H04-B02 - Proposition 2.2.4b|Regularization Proposition 2.2.4b]] · 正则化命题 2.2.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch02-S02-H04-B03 - Identity 2.2.4c|Regularization Identity 2.2.4c]] · 正则化恒等式 2.2.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S02-H05 - Main Theorem Feature Map|Main Theorem: Feature Map]] · 特征映射：主定理 · `⇠ 35` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch02-S02-H05-B01 - Proposition 2.2.5a|Feature Map Proposition 2.2.5a]] · 特征映射命题 2.2.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch02-S02-H05-B02 - Identity 2.2.5b|Feature Map Identity 2.2.5b]] · 特征映射恒等式 2.2.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S02-H05-B03 - Estimate 2.2.5c|Feature Map Estimate 2.2.5c]] · 特征映射估计 2.2.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S02-H05-B04 - Example 2.2.5d|Feature Map Example 2.2.5d]] · 特征映射例子 2.2.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S02-H06 - Proof and Consequences Kernel Matrix|Proof and Consequences: Kernel Matrix]] · 核矩阵：证明与推论 · `⇠ 30` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch02-S02-H06-B01 - Identity 2.2.6a|Kernel Matrix Identity 2.2.6a]] · 核矩阵恒等式 2.2.6a · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S02-H06-B02 - Estimate 2.2.6b|Kernel Matrix Estimate 2.2.6b]] · 核矩阵估计 2.2.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S02-H06-B03 - Example 2.2.6c|Kernel Matrix Example 2.2.6c]] · 核矩阵例子 2.2.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch02-S03` · [[Ch02-S03 - Main Results|Main Results — Normed Spaces and Operators]] · 赋范空间与算子：主要结果 · `⇠ 33` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S03-H01 - Definition Sample Complexity|Definition: Sample Complexity]] · 样本复杂度：定义 · `⇠ 58` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch02-S03-H01-B01 - Proposition 2.3.1a|Sample Complexity Proposition 2.3.1a]] · 样本复杂度命题 2.3.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch02-S03-H01-B02 - Identity 2.3.1b|Sample Complexity Identity 2.3.1b]] · 样本复杂度恒等式 2.3.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch02-S03-H01-B03 - Estimate 2.3.1c|Sample Complexity Estimate 2.3.1c]] · 样本复杂度估计 2.3.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S03-H01-B04 - Example 2.3.1d|Sample Complexity Example 2.3.1d]] · 样本复杂度例子 2.3.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S03-H02 - Notation Generalization Bound|Notation: Generalization Bound]] · 泛化界：记号约定 · `⇠ 21` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch02-S03-H02-B01 - Identity 2.3.2a|Generalization Bound Identity 2.3.2a]] · 泛化界恒等式 2.3.2a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch02-S03-H02-B02 - Estimate 2.3.2b|Generalization Bound Estimate 2.3.2b]] · 泛化界估计 2.3.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S03-H02-B03 - Example 2.3.2c|Generalization Bound Example 2.3.2c]] · 泛化界例子 2.3.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S03-H03 - Basic Properties Spectral Gap|Basic Properties: Spectral Gap]] · 谱隙：基本性质 · `⇠ 46` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch02-S03-H03-B01 - Estimate 2.3.3a|Spectral Gap Estimate 2.3.3a]] · 谱隙估计 2.3.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch02-S03-H03-B02 - Example 2.3.3b|Spectral Gap Example 2.3.3b]] · 谱隙例子 2.3.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S03-H03-B03 - Proposition 2.3.3c|Spectral Gap Proposition 2.3.3c]] · 谱隙命题 2.3.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S03-H03-B04 - Identity 2.3.3d|Spectral Gap Identity 2.3.3d]] · 谱隙恒等式 2.3.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S03-H04 - Key Lemma Markov Chain|Key Lemma: Markov Chain]] · 马尔可夫链：关键引理 · `⇠ 31` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch02-S03-H04-B01 - Example 2.3.4a|Markov Chain Example 2.3.4a]] · 马尔可夫链例子 2.3.4a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch02-S03-H04-B02 - Proposition 2.3.4b|Markov Chain Proposition 2.3.4b]] · 马尔可夫链命题 2.3.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch02-S03-H04-B03 - Identity 2.3.4c|Markov Chain Identity 2.3.4c]] · 马尔可夫链恒等式 2.3.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S03-H05 - Main Theorem Vector Space|Main Theorem: Vector Space]] · 向量空间：主定理 · `⇠ 23` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch02-S03-H05-B01 - Proposition 2.3.5a|Vector Space Proposition 2.3.5a]] · 向量空间命题 2.3.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch02-S03-H05-B02 - Identity 2.3.5b|Vector Space Identity 2.3.5b]] · 向量空间恒等式 2.3.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S03-H05-B03 - Estimate 2.3.5c|Vector Space Estimate 2.3.5c]] · 向量空间估计 2.3.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch02-S03-H05-B04 - Example 2.3.5d|Vector Space Example 2.3.5d]] · 向量空间例子 2.3.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S03-H06 - Proof and Consequences Linear Operator|Proof and Consequences: Linear Operator]] · 线性算子：证明与推论 · `⇠ 57` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch02-S03-H06-B01 - Identity 2.3.6a|Linear Operator Identity 2.3.6a]] · 线性算子恒等式 2.3.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch02-S03-H06-B02 - Estimate 2.3.6b|Linear Operator Estimate 2.3.6b]] · 线性算子估计 2.3.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch02-S03-H06-B03 - Example 2.3.6c|Linear Operator Example 2.3.6c]] · 线性算子例子 2.3.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch02-S04` · [[Ch02-S04 - Applications and Limits|Applications and Limits — Normed Spaces and Operators]] · 赋范空间与算子：应用与局限 · `⇠ 29` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S04-H01 - Definition Compact Set|Definition: Compact Set]] · 紧集：定义 · `⇠ 56` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch02-S04-H01-B01 - Proposition 2.4.1a|Compact Set Proposition 2.4.1a]] · 紧集命题 2.4.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch02-S04-H01-B02 - Identity 2.4.1b|Compact Set Identity 2.4.1b]] · 紧集恒等式 2.4.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S04-H01-B03 - Estimate 2.4.1c|Compact Set Estimate 2.4.1c]] · 紧集估计 2.4.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch02-S04-H01-B04 - Example 2.4.1d|Compact Set Example 2.4.1d]] · 紧集例子 2.4.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S04-H02 - Notation Metric Completion|Notation: Metric Completion]] · 度量完备化：记号约定 · `⇠ 27` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch02-S04-H02-B01 - Identity 2.4.2a|Metric Completion Identity 2.4.2a]] · 度量完备化恒等式 2.4.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch02-S04-H02-B02 - Estimate 2.4.2b|Metric Completion Estimate 2.4.2b]] · 度量完备化估计 2.4.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch02-S04-H02-B03 - Example 2.4.2c|Metric Completion Example 2.4.2c]] · 度量完备化例子 2.4.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S04-H03 - Basic Properties Orthogonal Projection|Basic Properties: Orthogonal Projection]] · 正交投影：基本性质 · `⇠ 37` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch02-S04-H03-B01 - Estimate 2.4.3a|Orthogonal Projection Estimate 2.4.3a]] · 正交投影估计 2.4.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch02-S04-H03-B02 - Example 2.4.3b|Orthogonal Projection Example 2.4.3b]] · 正交投影例子 2.4.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch02-S04-H03-B03 - Proposition 2.4.3c|Orthogonal Projection Proposition 2.4.3c]] · 正交投影命题 2.4.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch02-S04-H03-B04 - Identity 2.4.3d|Orthogonal Projection Identity 2.4.3d]] · 正交投影恒等式 2.4.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S04-H04 - Key Lemma Basis and Coordinates|Key Lemma: Basis and Coordinates]] · 基与坐标：关键引理 · `⇠ 31` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch02-S04-H04-B01 - Example 2.4.4a|Basis and Coordinates Example 2.4.4a]] · 基与坐标例子 2.4.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch02-S04-H04-B02 - Proposition 2.4.4b|Basis and Coordinates Proposition 2.4.4b]] · 基与坐标命题 2.4.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch02-S04-H04-B03 - Identity 2.4.4c|Basis and Coordinates Identity 2.4.4c]] · 基与坐标恒等式 2.4.4c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S04-H05 - Main Theorem Dual Space|Main Theorem: Dual Space]] · 对偶空间：主定理 · `⇠ 35` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch02-S04-H05-B01 - Proposition 2.4.5a|Dual Space Proposition 2.4.5a]] · 对偶空间命题 2.4.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch02-S04-H05-B02 - Identity 2.4.5b|Dual Space Identity 2.4.5b]] · 对偶空间恒等式 2.4.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch02-S04-H05-B03 - Estimate 2.4.5c|Dual Space Estimate 2.4.5c]] · 对偶空间估计 2.4.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S04-H05-B04 - Example 2.4.5d|Dual Space Example 2.4.5d]] · 对偶空间例子 2.4.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch02-S04-H06 - Proof and Consequences Adjoint Operator|Proof and Consequences: Adjoint Operator]] · 伴随算子：证明与推论 · `⇠ 21` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch02-S04-H06-B01 - Identity 2.4.6a|Adjoint Operator Identity 2.4.6a]] · 伴随算子恒等式 2.4.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch02-S04-H06-B02 - Estimate 2.4.6b|Adjoint Operator Estimate 2.4.6b]] · 伴随算子估计 2.4.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch02-S04-H06-B03 - Example 2.4.6c|Adjoint Operator Example 2.4.6c]] · 伴随算子例子 2.4.6c · `⇠ 3` · `∑` · `◌`

## Ch03 · Inner Products and Orthogonality

> [!chapter]+ 🟡 *内积与正交性* · [[Ch03 - Inner Products and Orthogonality|Inner Products and Orthogonality]] · `148` · исходящих `5`
>
> > [!section]+ 🔵 `Ch03-S01` · [[Ch03-S01 - Setup and Notation|Setup and Notation — Inner Products and Orthogonality]] · 内积与正交性：预备知识与记号 · `⇠ 45` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S01-H01 - Definition Spectral Theorem|Definition: Spectral Theorem]] · 谱定理：定义 · `⇠ 50` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch03-S01-H01-B01 - Proposition 3.1.1a|Spectral Theorem Proposition 3.1.1a]] · 谱定理命题 3.1.1a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch03-S01-H01-B02 - Identity 3.1.1b|Spectral Theorem Identity 3.1.1b]] · 谱定理恒等式 3.1.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch03-S01-H01-B03 - Estimate 3.1.1c|Spectral Theorem Estimate 3.1.1c]] · 谱定理估计 3.1.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S01-H01-B04 - Example 3.1.1d|Spectral Theorem Example 3.1.1d]] · 谱定理例子 3.1.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S01-H02 - Notation Norm Equivalence|Notation: Norm Equivalence]] · 范数等价：记号约定 · `⇠ 45` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch03-S01-H02-B01 - Identity 3.1.2a|Norm Equivalence Identity 3.1.2a]] · 范数等价恒等式 3.1.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch03-S01-H02-B02 - Estimate 3.1.2b|Norm Equivalence Estimate 3.1.2b]] · 范数等价估计 3.1.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S01-H02-B03 - Example 3.1.2c|Norm Equivalence Example 3.1.2c]] · 范数等价例子 3.1.2c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S01-H03 - Basic Properties Contraction Mapping|Basic Properties: Contraction Mapping]] · 压缩映射：基本性质 · `⇠ 49` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch03-S01-H03-B01 - Estimate 3.1.3a|Contraction Mapping Estimate 3.1.3a]] · 压缩映射估计 3.1.3a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch03-S01-H03-B02 - Example 3.1.3b|Contraction Mapping Example 3.1.3b]] · 压缩映射例子 3.1.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S01-H03-B03 - Proposition 3.1.3c|Contraction Mapping Proposition 3.1.3c]] · 压缩映射命题 3.1.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch03-S01-H03-B04 - Identity 3.1.3d|Contraction Mapping Identity 3.1.3d]] · 压缩映射恒等式 3.1.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S01-H04 - Key Lemma Fixed Point|Key Lemma: Fixed Point]] · 不动点：关键引理 · `⇠ 37` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch03-S01-H04-B01 - Example 3.1.4a|Fixed Point Example 3.1.4a]] · 不动点例子 3.1.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch03-S01-H04-B02 - Proposition 3.1.4b|Fixed Point Proposition 3.1.4b]] · 不动点命题 3.1.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch03-S01-H04-B03 - Identity 3.1.4c|Fixed Point Identity 3.1.4c]] · 不动点恒等式 3.1.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S01-H05 - Main Theorem Banach Limit|Main Theorem: Banach Limit]] · 巴拿赫极限：主定理 · `⇠ 29` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch03-S01-H05-B01 - Proposition 3.1.5a|Banach Limit Proposition 3.1.5a]] · 巴拿赫极限命题 3.1.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch03-S01-H05-B02 - Identity 3.1.5b|Banach Limit Identity 3.1.5b]] · 巴拿赫极限恒等式 3.1.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch03-S01-H05-B03 - Estimate 3.1.5c|Banach Limit Estimate 3.1.5c]] · 巴拿赫极限估计 3.1.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch03-S01-H05-B04 - Example 3.1.5d|Banach Limit Example 3.1.5d]] · 巴拿赫极限例子 3.1.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S01-H06 - Proof and Consequences Hilbert Decomposition|Proof and Consequences: Hilbert Decomposition]] · 希尔伯特分解：证明与推论 · `⇠ 27` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch03-S01-H06-B01 - Identity 3.1.6a|Hilbert Decomposition Identity 3.1.6a]] · 希尔伯特分解恒等式 3.1.6a · `⇠ 11` · `∑` · `◌`
> > > > - [[Ch03-S01-H06-B02 - Estimate 3.1.6b|Hilbert Decomposition Estimate 3.1.6b]] · 希尔伯特分解估计 3.1.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch03-S01-H06-B03 - Example 3.1.6c|Hilbert Decomposition Example 3.1.6c]] · 希尔伯特分解例子 3.1.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch03-S02` · [[Ch03-S02 - Core Theory|Core Theory — Inner Products and Orthogonality]] · 内积与正交性：核心理论 · `⇠ 33` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S02-H01 - Definition Weak Convergence|Definition: Weak Convergence]] · 弱收敛：定义 · `⇠ 47` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch03-S02-H01-B01 - Proposition 3.2.1a|Weak Convergence Proposition 3.2.1a]] · 弱收敛命题 3.2.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch03-S02-H01-B02 - Identity 3.2.1b|Weak Convergence Identity 3.2.1b]] · 弱收敛恒等式 3.2.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S02-H01-B03 - Estimate 3.2.1c|Weak Convergence Estimate 3.2.1c]] · 弱收敛估计 3.2.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch03-S02-H01-B04 - Example 3.2.1d|Weak Convergence Example 3.2.1d]] · 弱收敛例子 3.2.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S02-H02 - Notation Density Argument|Notation: Density Argument]] · 稠密性论证：记号约定 · `⇠ 39` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch03-S02-H02-B01 - Identity 3.2.2a|Density Argument Identity 3.2.2a]] · 稠密性论证恒等式 3.2.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch03-S02-H02-B02 - Estimate 3.2.2b|Density Argument Estimate 3.2.2b]] · 稠密性论证估计 3.2.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch03-S02-H02-B03 - Example 3.2.2c|Density Argument Example 3.2.2c]] · 稠密性论证例子 3.2.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S02-H03 - Basic Properties Kernel and Range|Basic Properties: Kernel and Range]] · 核与值域：基本性质 · `⇠ 16` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch03-S02-H03-B01 - Estimate 3.2.3a|Kernel and Range Estimate 3.2.3a]] · 核与值域估计 3.2.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch03-S02-H03-B02 - Example 3.2.3b|Kernel and Range Example 3.2.3b]] · 核与值域例子 3.2.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch03-S02-H03-B03 - Proposition 3.2.3c|Kernel and Range Proposition 3.2.3c]] · 核与值域命题 3.2.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S02-H03-B04 - Identity 3.2.3d|Kernel and Range Identity 3.2.3d]] · 核与值域恒等式 3.2.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S02-H04 - Key Lemma Eigenvalue Bounds|Key Lemma: Eigenvalue Bounds]] · 特征值估计：关键引理 · `⇠ 37` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch03-S02-H04-B01 - Example 3.2.4a|Eigenvalue Bounds Example 3.2.4a]] · 特征值估计例子 3.2.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch03-S02-H04-B02 - Proposition 3.2.4b|Eigenvalue Bounds Proposition 3.2.4b]] · 特征值估计命题 3.2.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch03-S02-H04-B03 - Identity 3.2.4c|Eigenvalue Bounds Identity 3.2.4c]] · 特征值估计恒等式 3.2.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S02-H05 - Main Theorem Singular Values|Main Theorem: Singular Values]] · 奇异值：主定理 · `⇠ 41` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch03-S02-H05-B01 - Proposition 3.2.5a|Singular Values Proposition 3.2.5a]] · 奇异值命题 3.2.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch03-S02-H05-B02 - Identity 3.2.5b|Singular Values Identity 3.2.5b]] · 奇异值恒等式 3.2.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S02-H05-B03 - Estimate 3.2.5c|Singular Values Estimate 3.2.5c]] · 奇异值估计 3.2.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S02-H05-B04 - Example 3.2.5d|Singular Values Example 3.2.5d]] · 奇异值例子 3.2.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S02-H06 - Proof and Consequences Trace Class|Proof and Consequences: Trace Class]] · 迹类：证明与推论 · `⇠ 18` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch03-S02-H06-B01 - Identity 3.2.6a|Trace Class Identity 3.2.6a]] · 迹类恒等式 3.2.6a · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S02-H06-B02 - Estimate 3.2.6b|Trace Class Estimate 3.2.6b]] · 迹类估计 3.2.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S02-H06-B03 - Example 3.2.6c|Trace Class Example 3.2.6c]] · 迹类例子 3.2.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch03-S03` · [[Ch03-S03 - Main Results|Main Results — Inner Products and Orthogonality]] · 内积与正交性：主要结果 · `⇠ 40` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S03-H01 - Definition Convex Hull|Definition: Convex Hull]] · 凸包：定义 · `⇠ 40` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch03-S03-H01-B01 - Proposition 3.3.1a|Convex Hull Proposition 3.3.1a]] · 凸包命题 3.3.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch03-S03-H01-B02 - Identity 3.3.1b|Convex Hull Identity 3.3.1b]] · 凸包恒等式 3.3.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch03-S03-H01-B03 - Estimate 3.3.1c|Convex Hull Estimate 3.3.1c]] · 凸包估计 3.3.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S03-H01-B04 - Example 3.3.1d|Convex Hull Example 3.3.1d]] · 凸包例子 3.3.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S03-H02 - Notation Separation Theorem|Notation: Separation Theorem]] · 分离定理：记号约定 · `⇠ 18` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch03-S03-H02-B01 - Identity 3.3.2a|Separation Theorem Identity 3.3.2a]] · 分离定理恒等式 3.3.2a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch03-S03-H02-B02 - Estimate 3.3.2b|Separation Theorem Estimate 3.3.2b]] · 分离定理估计 3.3.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S03-H02-B03 - Example 3.3.2c|Separation Theorem Example 3.3.2c]] · 分离定理例子 3.3.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S03-H03 - Basic Properties Hahn-Banach Extension|Basic Properties: Hahn-Banach Extension]] · 哈恩-巴拿赫延拓：基本性质 · `⇠ 37` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch03-S03-H03-B01 - Estimate 3.3.3a|Hahn-Banach Extension Estimate 3.3.3a]] · 哈恩-巴拿赫延拓估计 3.3.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch03-S03-H03-B02 - Example 3.3.3b|Hahn-Banach Extension Example 3.3.3b]] · 哈恩-巴拿赫延拓例子 3.3.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S03-H03-B03 - Proposition 3.3.3c|Hahn-Banach Extension Proposition 3.3.3c]] · 哈恩-巴拿赫延拓命题 3.3.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S03-H03-B04 - Identity 3.3.3d|Hahn-Banach Extension Identity 3.3.3d]] · 哈恩-巴拿赫延拓恒等式 3.3.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S03-H04 - Key Lemma Open Mapping|Key Lemma: Open Mapping]] · 开映射：关键引理 · `⇠ 22` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch03-S03-H04-B01 - Example 3.3.4a|Open Mapping Example 3.3.4a]] · 开映射例子 3.3.4a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch03-S03-H04-B02 - Proposition 3.3.4b|Open Mapping Proposition 3.3.4b]] · 开映射命题 3.3.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch03-S03-H04-B03 - Identity 3.3.4c|Open Mapping Identity 3.3.4c]] · 开映射恒等式 3.3.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S03-H05 - Main Theorem Closed Graph|Main Theorem: Closed Graph]] · 闭图像：主定理 · `⇠ 38` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch03-S03-H05-B01 - Proposition 3.3.5a|Closed Graph Proposition 3.3.5a]] · 闭图像命题 3.3.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch03-S03-H05-B02 - Identity 3.3.5b|Closed Graph Identity 3.3.5b]] · 闭图像恒等式 3.3.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S03-H05-B03 - Estimate 3.3.5c|Closed Graph Estimate 3.3.5c]] · 闭图像估计 3.3.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch03-S03-H05-B04 - Example 3.3.5d|Closed Graph Example 3.3.5d]] · 闭图像例子 3.3.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S03-H06 - Proof and Consequences Uniform Boundedness|Proof and Consequences: Uniform Boundedness]] · 一致有界性：证明与推论 · `⇠ 33` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch03-S03-H06-B01 - Identity 3.3.6a|Uniform Boundedness Identity 3.3.6a]] · 一致有界性恒等式 3.3.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch03-S03-H06-B02 - Estimate 3.3.6b|Uniform Boundedness Estimate 3.3.6b]] · 一致有界性估计 3.3.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch03-S03-H06-B03 - Example 3.3.6c|Uniform Boundedness Example 3.3.6c]] · 一致有界性例子 3.3.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch03-S04` · [[Ch03-S04 - Applications and Limits|Applications and Limits — Inner Products and Orthogonality]] · 内积与正交性：应用与局限 · `⇠ 46` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S04-H01 - Definition Approximation Error|Definition: Approximation Error]] · 逼近误差：定义 · `⇠ 56` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch03-S04-H01-B01 - Proposition 3.4.1a|Approximation Error Proposition 3.4.1a]] · 逼近误差命题 3.4.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch03-S04-H01-B02 - Identity 3.4.1b|Approximation Error Identity 3.4.1b]] · 逼近误差恒等式 3.4.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S04-H01-B03 - Estimate 3.4.1c|Approximation Error Estimate 3.4.1c]] · 逼近误差估计 3.4.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch03-S04-H01-B04 - Example 3.4.1d|Approximation Error Example 3.4.1d]] · 逼近误差例子 3.4.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S04-H02 - Notation Radon-Nikodym Derivative|Notation: Radon-Nikodym Derivative]] · 拉东-尼科迪姆导数：记号约定 · `⇠ 27` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch03-S04-H02-B01 - Identity 3.4.2a|Radon-Nikodym Derivative Identity 3.4.2a]] · 拉东-尼科迪姆导数恒等式 3.4.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch03-S04-H02-B02 - Estimate 3.4.2b|Radon-Nikodym Derivative Estimate 3.4.2b]] · 拉东-尼科迪姆导数估计 3.4.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch03-S04-H02-B03 - Example 3.4.2c|Radon-Nikodym Derivative Example 3.4.2c]] · 拉东-尼科迪姆导数例子 3.4.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S04-H03 - Basic Properties Entropy Bound|Basic Properties: Entropy Bound]] · 熵界：基本性质 · `⇠ 49` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch03-S04-H03-B01 - Estimate 3.4.3a|Entropy Bound Estimate 3.4.3a]] · 熵界估计 3.4.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch03-S04-H03-B02 - Example 3.4.3b|Entropy Bound Example 3.4.3b]] · 熵界例子 3.4.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch03-S04-H03-B03 - Proposition 3.4.3c|Entropy Bound Proposition 3.4.3c]] · 熵界命题 3.4.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch03-S04-H03-B04 - Identity 3.4.3d|Entropy Bound Identity 3.4.3d]] · 熵界恒等式 3.4.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S04-H04 - Key Lemma Concentration Inequality|Key Lemma: Concentration Inequality]] · 集中不等式：关键引理 · `⇠ 28` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch03-S04-H04-B01 - Example 3.4.4a|Concentration Inequality Example 3.4.4a]] · 集中不等式例子 3.4.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch03-S04-H04-B02 - Proposition 3.4.4b|Concentration Inequality Proposition 3.4.4b]] · 集中不等式命题 3.4.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch03-S04-H04-B03 - Identity 3.4.4c|Concentration Inequality Identity 3.4.4c]] · 集中不等式恒等式 3.4.4c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S04-H05 - Main Theorem Gradient Descent|Main Theorem: Gradient Descent]] · 梯度下降：主定理 · `⇠ 38` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch03-S04-H05-B01 - Proposition 3.4.5a|Gradient Descent Proposition 3.4.5a]] · 梯度下降命题 3.4.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch03-S04-H05-B02 - Identity 3.4.5b|Gradient Descent Identity 3.4.5b]] · 梯度下降恒等式 3.4.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch03-S04-H05-B03 - Estimate 3.4.5c|Gradient Descent Estimate 3.4.5c]] · 梯度下降估计 3.4.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S04-H05-B04 - Example 3.4.5d|Gradient Descent Example 3.4.5d]] · 梯度下降例子 3.4.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch03-S04-H06 - Proof and Consequences Lipschitz Continuity|Proof and Consequences: Lipschitz Continuity]] · 利普希茨连续性：证明与推论 · `⇠ 33` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch03-S04-H06-B01 - Identity 3.4.6a|Lipschitz Continuity Identity 3.4.6a]] · 利普希茨连续性恒等式 3.4.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch03-S04-H06-B02 - Estimate 3.4.6b|Lipschitz Continuity Estimate 3.4.6b]] · 利普希茨连续性估计 3.4.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch03-S04-H06-B03 - Example 3.4.6c|Lipschitz Continuity Example 3.4.6c]] · 利普希茨连续性例子 3.4.6c · `⇠ 3` · `∑` · `◌`

## Ch04 · Banach Space Theorems

> [!chapter]+ 🟡 *巴拿赫空间定理* · [[Ch04 - Banach Space Theorems|Banach Space Theorems]] · `138` · исходящих `5`
>
> > [!section]+ 🔵 `Ch04-S01` · [[Ch04-S01 - Setup and Notation|Setup and Notation — Banach Space Theorems]] · 巴拿赫空间定理：预备知识与记号 · `⇠ 30` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S01-H01 - Definition Duality Gap|Definition: Duality Gap]] · 对偶间隙：定义 · `⇠ 29` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch04-S01-H01-B01 - Proposition 4.1.1a|Duality Gap Proposition 4.1.1a]] · 对偶间隙命题 4.1.1a · `⇠ 69` · `∑` · `◌`
> > > > - [[Ch04-S01-H01-B02 - Identity 4.1.1b|Duality Gap Identity 4.1.1b]] · 对偶间隙恒等式 4.1.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch04-S01-H01-B03 - Estimate 4.1.1c|Duality Gap Estimate 4.1.1c]] · 对偶间隙估计 4.1.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S01-H01-B04 - Example 4.1.1d|Duality Gap Example 4.1.1d]] · 对偶间隙例子 4.1.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S01-H02 - Notation Regularization|Notation: Regularization]] · 正则化：记号约定 · `⇠ 27` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch04-S01-H02-B01 - Identity 4.1.2a|Regularization Identity 4.1.2a]] · 正则化恒等式 4.1.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch04-S01-H02-B02 - Estimate 4.1.2b|Regularization Estimate 4.1.2b]] · 正则化估计 4.1.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S01-H02-B03 - Example 4.1.2c|Regularization Example 4.1.2c]] · 正则化例子 4.1.2c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S01-H03 - Basic Properties Feature Map|Basic Properties: Feature Map]] · 特征映射：基本性质 · `⇠ 34` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch04-S01-H03-B01 - Estimate 4.1.3a|Feature Map Estimate 4.1.3a]] · 特征映射估计 4.1.3a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch04-S01-H03-B02 - Example 4.1.3b|Feature Map Example 4.1.3b]] · 特征映射例子 4.1.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S01-H03-B03 - Proposition 4.1.3c|Feature Map Proposition 4.1.3c]] · 特征映射命题 4.1.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch04-S01-H03-B04 - Identity 4.1.3d|Feature Map Identity 4.1.3d]] · 特征映射恒等式 4.1.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S01-H04 - Key Lemma Kernel Matrix|Key Lemma: Kernel Matrix]] · 核矩阵：关键引理 · `⇠ 31` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch04-S01-H04-B01 - Example 4.1.4a|Kernel Matrix Example 4.1.4a]] · 核矩阵例子 4.1.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch04-S01-H04-B02 - Proposition 4.1.4b|Kernel Matrix Proposition 4.1.4b]] · 核矩阵命题 4.1.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch04-S01-H04-B03 - Identity 4.1.4c|Kernel Matrix Identity 4.1.4c]] · 核矩阵恒等式 4.1.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S01-H05 - Main Theorem Sample Complexity|Main Theorem: Sample Complexity]] · 样本复杂度：主定理 · `⇠ 38` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch04-S01-H05-B01 - Proposition 4.1.5a|Sample Complexity Proposition 4.1.5a]] · 样本复杂度命题 4.1.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch04-S01-H05-B02 - Identity 4.1.5b|Sample Complexity Identity 4.1.5b]] · 样本复杂度恒等式 4.1.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch04-S01-H05-B03 - Estimate 4.1.5c|Sample Complexity Estimate 4.1.5c]] · 样本复杂度估计 4.1.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch04-S01-H05-B04 - Example 4.1.5d|Sample Complexity Example 4.1.5d]] · 样本复杂度例子 4.1.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S01-H06 - Proof and Consequences Generalization Bound|Proof and Consequences: Generalization Bound]] · 泛化界：证明与推论 · `⇠ 21` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch04-S01-H06-B01 - Identity 4.1.6a|Generalization Bound Identity 4.1.6a]] · 泛化界恒等式 4.1.6a · `⇠ 11` · `∑` · `◌`
> > > > - [[Ch04-S01-H06-B02 - Estimate 4.1.6b|Generalization Bound Estimate 4.1.6b]] · 泛化界估计 4.1.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch04-S01-H06-B03 - Example 4.1.6c|Generalization Bound Example 4.1.6c]] · 泛化界例子 4.1.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch04-S02` · [[Ch04-S02 - Core Theory|Core Theory — Banach Space Theorems]] · 巴拿赫空间定理：核心理论 · `⇠ 40` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S02-H01 - Definition Spectral Gap|Definition: Spectral Gap]] · 谱隙：定义 · `⇠ 55` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch04-S02-H01-B01 - Proposition 4.2.1a|Spectral Gap Proposition 4.2.1a]] · 谱隙命题 4.2.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch04-S02-H01-B02 - Identity 4.2.1b|Spectral Gap Identity 4.2.1b]] · 谱隙恒等式 4.2.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S02-H01-B03 - Estimate 4.2.1c|Spectral Gap Estimate 4.2.1c]] · 谱隙估计 4.2.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch04-S02-H01-B04 - Example 4.2.1d|Spectral Gap Example 4.2.1d]] · 谱隙例子 4.2.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S02-H02 - Notation Markov Chain|Notation: Markov Chain]] · 马尔可夫链：记号约定 · `⇠ 30` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch04-S02-H02-B01 - Identity 4.2.2a|Markov Chain Identity 4.2.2a]] · 马尔可夫链恒等式 4.2.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch04-S02-H02-B02 - Estimate 4.2.2b|Markov Chain Estimate 4.2.2b]] · 马尔可夫链估计 4.2.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch04-S02-H02-B03 - Example 4.2.2c|Markov Chain Example 4.2.2c]] · 马尔可夫链例子 4.2.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S02-H03 - Basic Properties Vector Space|Basic Properties: Vector Space]] · 向量空间：基本性质 · `⇠ 22` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch04-S02-H03-B01 - Estimate 4.2.3a|Vector Space Estimate 4.2.3a]] · 向量空间估计 4.2.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch04-S02-H03-B02 - Example 4.2.3b|Vector Space Example 4.2.3b]] · 向量空间例子 4.2.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch04-S02-H03-B03 - Proposition 4.2.3c|Vector Space Proposition 4.2.3c]] · 向量空间命题 4.2.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S02-H03-B04 - Identity 4.2.3d|Vector Space Identity 4.2.3d]] · 向量空间恒等式 4.2.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S02-H04 - Key Lemma Linear Operator|Key Lemma: Linear Operator]] · 线性算子：关键引理 · `⇠ 34` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch04-S02-H04-B01 - Example 4.2.4a|Linear Operator Example 4.2.4a]] · 线性算子例子 4.2.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch04-S02-H04-B02 - Proposition 4.2.4b|Linear Operator Proposition 4.2.4b]] · 线性算子命题 4.2.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch04-S02-H04-B03 - Identity 4.2.4c|Linear Operator Identity 4.2.4c]] · 线性算子恒等式 4.2.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S02-H05 - Main Theorem Compact Set|Main Theorem: Compact Set]] · 紧集：主定理 · `⇠ 41` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch04-S02-H05-B01 - Proposition 4.2.5a|Compact Set Proposition 4.2.5a]] · 紧集命题 4.2.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch04-S02-H05-B02 - Identity 4.2.5b|Compact Set Identity 4.2.5b]] · 紧集恒等式 4.2.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S02-H05-B03 - Estimate 4.2.5c|Compact Set Estimate 4.2.5c]] · 紧集估计 4.2.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S02-H05-B04 - Example 4.2.5d|Compact Set Example 4.2.5d]] · 紧集例子 4.2.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S02-H06 - Proof and Consequences Metric Completion|Proof and Consequences: Metric Completion]] · 度量完备化：证明与推论 · `⇠ 27` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch04-S02-H06-B01 - Identity 4.2.6a|Metric Completion Identity 4.2.6a]] · 度量完备化恒等式 4.2.6a · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S02-H06-B02 - Estimate 4.2.6b|Metric Completion Estimate 4.2.6b]] · 度量完备化估计 4.2.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S02-H06-B03 - Example 4.2.6c|Metric Completion Example 4.2.6c]] · 度量完备化例子 4.2.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch04-S03` · [[Ch04-S03 - Main Results|Main Results — Banach Space Theorems]] · 巴拿赫空间定理：主要结果 · `⇠ 27` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S03-H01 - Definition Orthogonal Projection|Definition: Orthogonal Projection]] · 正交投影：定义 · `⇠ 58` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch04-S03-H01-B01 - Proposition 4.3.1a|Orthogonal Projection Proposition 4.3.1a]] · 正交投影命题 4.3.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch04-S03-H01-B02 - Identity 4.3.1b|Orthogonal Projection Identity 4.3.1b]] · 正交投影恒等式 4.3.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch04-S03-H01-B03 - Estimate 4.3.1c|Orthogonal Projection Estimate 4.3.1c]] · 正交投影估计 4.3.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S03-H01-B04 - Example 4.3.1d|Orthogonal Projection Example 4.3.1d]] · 正交投影例子 4.3.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S03-H02 - Notation Basis and Coordinates|Notation: Basis and Coordinates]] · 基与坐标：记号约定 · `⇠ 30` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch04-S03-H02-B01 - Identity 4.3.2a|Basis and Coordinates Identity 4.3.2a]] · 基与坐标恒等式 4.3.2a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch04-S03-H02-B02 - Estimate 4.3.2b|Basis and Coordinates Estimate 4.3.2b]] · 基与坐标估计 4.3.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S03-H02-B03 - Example 4.3.2c|Basis and Coordinates Example 4.3.2c]] · 基与坐标例子 4.3.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S03-H03 - Basic Properties Dual Space|Basic Properties: Dual Space]] · 对偶空间：基本性质 · `⇠ 34` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch04-S03-H03-B01 - Estimate 4.3.3a|Dual Space Estimate 4.3.3a]] · 对偶空间估计 4.3.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch04-S03-H03-B02 - Example 4.3.3b|Dual Space Example 4.3.3b]] · 对偶空间例子 4.3.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S03-H03-B03 - Proposition 4.3.3c|Dual Space Proposition 4.3.3c]] · 对偶空间命题 4.3.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S03-H03-B04 - Identity 4.3.3d|Dual Space Identity 4.3.3d]] · 对偶空间恒等式 4.3.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S03-H04 - Key Lemma Adjoint Operator|Key Lemma: Adjoint Operator]] · 伴随算子：关键引理 · `⇠ 22` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch04-S03-H04-B01 - Example 4.3.4a|Adjoint Operator Example 4.3.4a]] · 伴随算子例子 4.3.4a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch04-S03-H04-B02 - Proposition 4.3.4b|Adjoint Operator Proposition 4.3.4b]] · 伴随算子命题 4.3.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch04-S03-H04-B03 - Identity 4.3.4c|Adjoint Operator Identity 4.3.4c]] · 伴随算子恒等式 4.3.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S03-H05 - Main Theorem Spectral Theorem|Main Theorem: Spectral Theorem]] · 谱定理：主定理 · `⇠ 38` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch04-S03-H05-B01 - Proposition 4.3.5a|Spectral Theorem Proposition 4.3.5a]] · 谱定理命题 4.3.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch04-S03-H05-B02 - Identity 4.3.5b|Spectral Theorem Identity 4.3.5b]] · 谱定理恒等式 4.3.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S03-H05-B03 - Estimate 4.3.5c|Spectral Theorem Estimate 4.3.5c]] · 谱定理估计 4.3.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch04-S03-H05-B04 - Example 4.3.5d|Spectral Theorem Example 4.3.5d]] · 谱定理例子 4.3.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S03-H06 - Proof and Consequences Norm Equivalence|Proof and Consequences: Norm Equivalence]] · 范数等价：证明与推论 · `⇠ 45` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch04-S03-H06-B01 - Identity 4.3.6a|Norm Equivalence Identity 4.3.6a]] · 范数等价恒等式 4.3.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch04-S03-H06-B02 - Estimate 4.3.6b|Norm Equivalence Estimate 4.3.6b]] · 范数等价估计 4.3.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch04-S03-H06-B03 - Example 4.3.6c|Norm Equivalence Example 4.3.6c]] · 范数等价例子 4.3.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch04-S04` · [[Ch04-S04 - Applications and Limits|Applications and Limits — Banach Space Theorems]] · 巴拿赫空间定理：应用与局限 · `⇠ 37` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S04-H01 - Definition Contraction Mapping|Definition: Contraction Mapping]] · 压缩映射：定义 · `⇠ 81` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch04-S04-H01-B01 - Proposition 4.4.1a|Contraction Mapping Proposition 4.4.1a]] · 压缩映射命题 4.4.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch04-S04-H01-B02 - Identity 4.4.1b|Contraction Mapping Identity 4.4.1b]] · 压缩映射恒等式 4.4.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S04-H01-B03 - Estimate 4.4.1c|Contraction Mapping Estimate 4.4.1c]] · 压缩映射估计 4.4.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch04-S04-H01-B04 - Example 4.4.1d|Contraction Mapping Example 4.4.1d]] · 压缩映射例子 4.4.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S04-H02 - Notation Fixed Point|Notation: Fixed Point]] · 不动点：记号约定 · `⇠ 36` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch04-S04-H02-B01 - Identity 4.4.2a|Fixed Point Identity 4.4.2a]] · 不动点恒等式 4.4.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch04-S04-H02-B02 - Estimate 4.4.2b|Fixed Point Estimate 4.4.2b]] · 不动点估计 4.4.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch04-S04-H02-B03 - Example 4.4.2c|Fixed Point Example 4.4.2c]] · 不动点例子 4.4.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S04-H03 - Basic Properties Banach Limit|Basic Properties: Banach Limit]] · 巴拿赫极限：基本性质 · `⇠ 28` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch04-S04-H03-B01 - Estimate 4.4.3a|Banach Limit Estimate 4.4.3a]] · 巴拿赫极限估计 4.4.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch04-S04-H03-B02 - Example 4.4.3b|Banach Limit Example 4.4.3b]] · 巴拿赫极限例子 4.4.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch04-S04-H03-B03 - Proposition 4.4.3c|Banach Limit Proposition 4.4.3c]] · 巴拿赫极限命题 4.4.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch04-S04-H03-B04 - Identity 4.4.3d|Banach Limit Identity 4.4.3d]] · 巴拿赫极限恒等式 4.4.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S04-H04 - Key Lemma Hilbert Decomposition|Key Lemma: Hilbert Decomposition]] · 希尔伯特分解：关键引理 · `⇠ 28` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch04-S04-H04-B01 - Example 4.4.4a|Hilbert Decomposition Example 4.4.4a]] · 希尔伯特分解例子 4.4.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch04-S04-H04-B02 - Proposition 4.4.4b|Hilbert Decomposition Proposition 4.4.4b]] · 希尔伯特分解命题 4.4.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch04-S04-H04-B03 - Identity 4.4.4c|Hilbert Decomposition Identity 4.4.4c]] · 希尔伯特分解恒等式 4.4.4c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S04-H05 - Main Theorem Weak Convergence|Main Theorem: Weak Convergence]] · 弱收敛：主定理 · `⇠ 29` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch04-S04-H05-B01 - Proposition 4.4.5a|Weak Convergence Proposition 4.4.5a]] · 弱收敛命题 4.4.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch04-S04-H05-B02 - Identity 4.4.5b|Weak Convergence Identity 4.4.5b]] · 弱收敛恒等式 4.4.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch04-S04-H05-B03 - Estimate 4.4.5c|Weak Convergence Estimate 4.4.5c]] · 弱收敛估计 4.4.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S04-H05-B04 - Example 4.4.5d|Weak Convergence Example 4.4.5d]] · 弱收敛例子 4.4.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch04-S04-H06 - Proof and Consequences Density Argument|Proof and Consequences: Density Argument]] · 稠密性论证：证明与推论 · `⇠ 39` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch04-S04-H06-B01 - Identity 4.4.6a|Density Argument Identity 4.4.6a]] · 稠密性论证恒等式 4.4.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch04-S04-H06-B02 - Estimate 4.4.6b|Density Argument Estimate 4.4.6b]] · 稠密性论证估计 4.4.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch04-S04-H06-B03 - Example 4.4.6c|Density Argument Example 4.4.6c]] · 稠密性论证例子 4.4.6c · `⇠ 3` · `∑` · `◌`

## Ch05 · Hilbert Space Geometry

> [!chapter]+ 🟡 *希尔伯特空间几何* · [[Ch05 - Hilbert Space Geometry|Hilbert Space Geometry]] · `155` · исходящих `5`
>
> > [!section]+ 🔵 `Ch05-S01` · [[Ch05-S01 - Setup and Notation|Setup and Notation — Hilbert Space Geometry]] · 希尔伯特空间几何：预备知识与记号 · `⇠ 23` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S01-H01 - Definition Kernel and Range|Definition: Kernel and Range]] · 核与值域：定义 · `⇠ 17` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch05-S01-H01-B01 - Proposition 5.1.1a|Kernel and Range Proposition 5.1.1a]] · 核与值域命题 5.1.1a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch05-S01-H01-B02 - Identity 5.1.1b|Kernel and Range Identity 5.1.1b]] · 核与值域恒等式 5.1.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch05-S01-H01-B03 - Estimate 5.1.1c|Kernel and Range Estimate 5.1.1c]] · 核与值域估计 5.1.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S01-H01-B04 - Example 5.1.1d|Kernel and Range Example 5.1.1d]] · 核与值域例子 5.1.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S01-H02 - Notation Eigenvalue Bounds|Notation: Eigenvalue Bounds]] · 特征值估计：记号约定 · `⇠ 27` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch05-S01-H02-B01 - Identity 5.1.2a|Eigenvalue Bounds Identity 5.1.2a]] · 特征值估计恒等式 5.1.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch05-S01-H02-B02 - Estimate 5.1.2b|Eigenvalue Bounds Estimate 5.1.2b]] · 特征值估计估计 5.1.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S01-H02-B03 - Example 5.1.2c|Eigenvalue Bounds Example 5.1.2c]] · 特征值估计例子 5.1.2c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S01-H03 - Basic Properties Singular Values|Basic Properties: Singular Values]] · 奇异值：基本性质 · `⇠ 20` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch05-S01-H03-B01 - Estimate 5.1.3a|Singular Values Estimate 5.1.3a]] · 奇异值估计 5.1.3a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch05-S01-H03-B02 - Example 5.1.3b|Singular Values Example 5.1.3b]] · 奇异值例子 5.1.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S01-H03-B03 - Proposition 5.1.3c|Singular Values Proposition 5.1.3c]] · 奇异值命题 5.1.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch05-S01-H03-B04 - Identity 5.1.3d|Singular Values Identity 5.1.3d]] · 奇异值恒等式 5.1.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S01-H04 - Key Lemma Trace Class|Key Lemma: Trace Class]] · 迹类：关键引理 · `⇠ 16` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch05-S01-H04-B01 - Example 5.1.4a|Trace Class Example 5.1.4a]] · 迹类例子 5.1.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch05-S01-H04-B02 - Proposition 5.1.4b|Trace Class Proposition 5.1.4b]] · 迹类命题 5.1.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch05-S01-H04-B03 - Identity 5.1.4c|Trace Class Identity 5.1.4c]] · 迹类恒等式 5.1.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S01-H05 - Main Theorem Convex Hull|Main Theorem: Convex Hull]] · 凸包：主定理 · `⇠ 16` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch05-S01-H05-B01 - Proposition 5.1.5a|Convex Hull Proposition 5.1.5a]] · 凸包命题 5.1.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch05-S01-H05-B02 - Identity 5.1.5b|Convex Hull Identity 5.1.5b]] · 凸包恒等式 5.1.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch05-S01-H05-B03 - Estimate 5.1.5c|Convex Hull Estimate 5.1.5c]] · 凸包估计 5.1.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch05-S01-H05-B04 - Example 5.1.5d|Convex Hull Example 5.1.5d]] · 凸包例子 5.1.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S01-H06 - Proof and Consequences Separation Theorem|Proof and Consequences: Separation Theorem]] · 分离定理：证明与推论 · `⇠ 15` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch05-S01-H06-B01 - Identity 5.1.6a|Separation Theorem Identity 5.1.6a]] · 分离定理恒等式 5.1.6a · `⇠ 11` · `∑` · `◌`
> > > > - [[Ch05-S01-H06-B02 - Estimate 5.1.6b|Separation Theorem Estimate 5.1.6b]] · 分离定理估计 5.1.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch05-S01-H06-B03 - Example 5.1.6c|Separation Theorem Example 5.1.6c]] · 分离定理例子 5.1.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch05-S02` · [[Ch05-S02 - Core Theory|Core Theory — Hilbert Space Geometry]] · 希尔伯特空间几何：核心理论 · `⇠ 28` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S02-H01 - Definition Hahn-Banach Extension|Definition: Hahn-Banach Extension]] · 哈恩-巴拿赫延拓：定义 · `⇠ 36` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch05-S02-H01-B01 - Proposition 5.2.1a|Hahn-Banach Extension Proposition 5.2.1a]] · 哈恩-巴拿赫延拓命题 5.2.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch05-S02-H01-B02 - Identity 5.2.1b|Hahn-Banach Extension Identity 5.2.1b]] · 哈恩-巴拿赫延拓恒等式 5.2.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S02-H01-B03 - Estimate 5.2.1c|Hahn-Banach Extension Estimate 5.2.1c]] · 哈恩-巴拿赫延拓估计 5.2.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch05-S02-H01-B04 - Example 5.2.1d|Hahn-Banach Extension Example 5.2.1d]] · 哈恩-巴拿赫延拓例子 5.2.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S02-H02 - Notation Open Mapping|Notation: Open Mapping]] · 开映射：记号约定 · `⇠ 13` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch05-S02-H02-B01 - Identity 5.2.2a|Open Mapping Identity 5.2.2a]] · 开映射恒等式 5.2.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch05-S02-H02-B02 - Estimate 5.2.2b|Open Mapping Estimate 5.2.2b]] · 开映射估计 5.2.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch05-S02-H02-B03 - Example 5.2.2c|Open Mapping Example 5.2.2c]] · 开映射例子 5.2.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S02-H03 - Basic Properties Closed Graph|Basic Properties: Closed Graph]] · 闭图像：基本性质 · `⇠ 28` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch05-S02-H03-B01 - Estimate 5.2.3a|Closed Graph Estimate 5.2.3a]] · 闭图像估计 5.2.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch05-S02-H03-B02 - Example 5.2.3b|Closed Graph Example 5.2.3b]] · 闭图像例子 5.2.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch05-S02-H03-B03 - Proposition 5.2.3c|Closed Graph Proposition 5.2.3c]] · 闭图像命题 5.2.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S02-H03-B04 - Identity 5.2.3d|Closed Graph Identity 5.2.3d]] · 闭图像恒等式 5.2.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S02-H04 - Key Lemma Uniform Boundedness|Key Lemma: Uniform Boundedness]] · 一致有界性：关键引理 · `⇠ 18` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch05-S02-H04-B01 - Example 5.2.4a|Uniform Boundedness Example 5.2.4a]] · 一致有界性例子 5.2.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch05-S02-H04-B02 - Proposition 5.2.4b|Uniform Boundedness Proposition 5.2.4b]] · 一致有界性命题 5.2.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch05-S02-H04-B03 - Identity 5.2.4c|Uniform Boundedness Identity 5.2.4c]] · 一致有界性恒等式 5.2.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S02-H05 - Main Theorem Approximation Error|Main Theorem: Approximation Error]] · 逼近误差：主定理 · `⇠ 35` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch05-S02-H05-B01 - Proposition 5.2.5a|Approximation Error Proposition 5.2.5a]] · 逼近误差命题 5.2.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch05-S02-H05-B02 - Identity 5.2.5b|Approximation Error Identity 5.2.5b]] · 逼近误差恒等式 5.2.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S02-H05-B03 - Estimate 5.2.5c|Approximation Error Estimate 5.2.5c]] · 逼近误差估计 5.2.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S02-H05-B04 - Example 5.2.5d|Approximation Error Example 5.2.5d]] · 逼近误差例子 5.2.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S02-H06 - Proof and Consequences Radon-Nikodym Derivative|Proof and Consequences: Radon-Nikodym Derivative]] · 拉东-尼科迪姆导数：证明与推论 · `⇠ 15` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch05-S02-H06-B01 - Identity 5.2.6a|Radon-Nikodym Derivative Identity 5.2.6a]] · 拉东-尼科迪姆导数恒等式 5.2.6a · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S02-H06-B02 - Estimate 5.2.6b|Radon-Nikodym Derivative Estimate 5.2.6b]] · 拉东-尼科迪姆导数估计 5.2.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S02-H06-B03 - Example 5.2.6c|Radon-Nikodym Derivative Example 5.2.6c]] · 拉东-尼科迪姆导数例子 5.2.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch05-S03` · [[Ch05-S03 - Main Results|Main Results — Hilbert Space Geometry]] · 希尔伯特空间几何：主要结果 · `⇠ 31` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S03-H01 - Definition Entropy Bound|Definition: Entropy Bound]] · 熵界：定义 · `⇠ 32` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch05-S03-H01-B01 - Proposition 5.3.1a|Entropy Bound Proposition 5.3.1a]] · 熵界命题 5.3.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch05-S03-H01-B02 - Identity 5.3.1b|Entropy Bound Identity 5.3.1b]] · 熵界恒等式 5.3.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch05-S03-H01-B03 - Estimate 5.3.1c|Entropy Bound Estimate 5.3.1c]] · 熵界估计 5.3.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S03-H01-B04 - Example 5.3.1d|Entropy Bound Example 5.3.1d]] · 熵界例子 5.3.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S03-H02 - Notation Concentration Inequality|Notation: Concentration Inequality]] · 集中不等式：记号约定 · `⇠ 21` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch05-S03-H02-B01 - Identity 5.3.2a|Concentration Inequality Identity 5.3.2a]] · 集中不等式恒等式 5.3.2a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch05-S03-H02-B02 - Estimate 5.3.2b|Concentration Inequality Estimate 5.3.2b]] · 集中不等式估计 5.3.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S03-H02-B03 - Example 5.3.2c|Concentration Inequality Example 5.3.2c]] · 集中不等式例子 5.3.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S03-H03 - Basic Properties Gradient Descent|Basic Properties: Gradient Descent]] · 梯度下降：基本性质 · `⇠ 19` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch05-S03-H03-B01 - Estimate 5.3.3a|Gradient Descent Estimate 5.3.3a]] · 梯度下降估计 5.3.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch05-S03-H03-B02 - Example 5.3.3b|Gradient Descent Example 5.3.3b]] · 梯度下降例子 5.3.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S03-H03-B03 - Proposition 5.3.3c|Gradient Descent Proposition 5.3.3c]] · 梯度下降命题 5.3.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S03-H03-B04 - Identity 5.3.3d|Gradient Descent Identity 5.3.3d]] · 梯度下降恒等式 5.3.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S03-H04 - Key Lemma Lipschitz Continuity|Key Lemma: Lipschitz Continuity]] · 利普希茨连续性：关键引理 · `⇠ 26` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch05-S03-H04-B01 - Example 5.3.4a|Lipschitz Continuity Example 5.3.4a]] · 利普希茨连续性例子 5.3.4a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch05-S03-H04-B02 - Proposition 5.3.4b|Lipschitz Continuity Proposition 5.3.4b]] · 利普希茨连续性命题 5.3.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch05-S03-H04-B03 - Identity 5.3.4c|Lipschitz Continuity Identity 5.3.4c]] · 利普希茨连续性恒等式 5.3.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S03-H05 - Main Theorem Duality Gap|Main Theorem: Duality Gap]] · 对偶间隙：主定理 · `⇠ 16` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch05-S03-H05-B01 - Proposition 5.3.5a|Duality Gap Proposition 5.3.5a]] · 对偶间隙命题 5.3.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch05-S03-H05-B02 - Identity 5.3.5b|Duality Gap Identity 5.3.5b]] · 对偶间隙恒等式 5.3.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S03-H05-B03 - Estimate 5.3.5c|Duality Gap Estimate 5.3.5c]] · 对偶间隙估计 5.3.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch05-S03-H05-B04 - Example 5.3.5d|Duality Gap Example 5.3.5d]] · 对偶间隙例子 5.3.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S03-H06 - Proof and Consequences Regularization|Proof and Consequences: Regularization]] · 正则化：证明与推论 · `⇠ 21` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch05-S03-H06-B01 - Identity 5.3.6a|Regularization Identity 5.3.6a]] · 正则化恒等式 5.3.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch05-S03-H06-B02 - Estimate 5.3.6b|Regularization Estimate 5.3.6b]] · 正则化估计 5.3.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch05-S03-H06-B03 - Example 5.3.6c|Regularization Example 5.3.6c]] · 正则化例子 5.3.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch05-S04` · [[Ch05-S04 - Applications and Limits|Applications and Limits — Hilbert Space Geometry]] · 希尔伯特空间几何：应用与局限 · `⇠ 27` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S04-H01 - Definition Feature Map|Definition: Feature Map]] · 特征映射：定义 · `⇠ 33` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch05-S04-H01-B01 - Proposition 5.4.1a|Feature Map Proposition 5.4.1a]] · 特征映射命题 5.4.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch05-S04-H01-B02 - Identity 5.4.1b|Feature Map Identity 5.4.1b]] · 特征映射恒等式 5.4.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S04-H01-B03 - Estimate 5.4.1c|Feature Map Estimate 5.4.1c]] · 特征映射估计 5.4.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch05-S04-H01-B04 - Example 5.4.1d|Feature Map Example 5.4.1d]] · 特征映射例子 5.4.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S04-H02 - Notation Kernel Matrix|Notation: Kernel Matrix]] · 核矩阵：记号约定 · `⇠ 16` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch05-S04-H02-B01 - Identity 5.4.2a|Kernel Matrix Identity 5.4.2a]] · 核矩阵恒等式 5.4.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch05-S04-H02-B02 - Estimate 5.4.2b|Kernel Matrix Estimate 5.4.2b]] · 核矩阵估计 5.4.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch05-S04-H02-B03 - Example 5.4.2c|Kernel Matrix Example 5.4.2c]] · 核矩阵例子 5.4.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S04-H03 - Basic Properties Sample Complexity|Basic Properties: Sample Complexity]] · 样本复杂度：基本性质 · `⇠ 28` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch05-S04-H03-B01 - Estimate 5.4.3a|Sample Complexity Estimate 5.4.3a]] · 样本复杂度估计 5.4.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch05-S04-H03-B02 - Example 5.4.3b|Sample Complexity Example 5.4.3b]] · 样本复杂度例子 5.4.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch05-S04-H03-B03 - Proposition 5.4.3c|Sample Complexity Proposition 5.4.3c]] · 样本复杂度命题 5.4.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch05-S04-H03-B04 - Identity 5.4.3d|Sample Complexity Identity 5.4.3d]] · 样本复杂度恒等式 5.4.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S04-H04 - Key Lemma Generalization Bound|Key Lemma: Generalization Bound]] · 泛化界：关键引理 · `⇠ 14` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch05-S04-H04-B01 - Example 5.4.4a|Generalization Bound Example 5.4.4a]] · 泛化界例子 5.4.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch05-S04-H04-B02 - Proposition 5.4.4b|Generalization Bound Proposition 5.4.4b]] · 泛化界命题 5.4.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch05-S04-H04-B03 - Identity 5.4.4c|Generalization Bound Identity 5.4.4c]] · 泛化界恒等式 5.4.4c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S04-H05 - Main Theorem Spectral Gap|Main Theorem: Spectral Gap]] · 谱隙：主定理 · `⇠ 35` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch05-S04-H05-B01 - Proposition 5.4.5a|Spectral Gap Proposition 5.4.5a]] · 谱隙命题 5.4.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch05-S04-H05-B02 - Identity 5.4.5b|Spectral Gap Identity 5.4.5b]] · 谱隙恒等式 5.4.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch05-S04-H05-B03 - Estimate 5.4.5c|Spectral Gap Estimate 5.4.5c]] · 谱隙估计 5.4.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S04-H05-B04 - Example 5.4.5d|Spectral Gap Example 5.4.5d]] · 谱隙例子 5.4.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch05-S04-H06 - Proof and Consequences Markov Chain|Proof and Consequences: Markov Chain]] · 马尔可夫链：证明与推论 · `⇠ 16` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch05-S04-H06-B01 - Identity 5.4.6a|Markov Chain Identity 5.4.6a]] · 马尔可夫链恒等式 5.4.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch05-S04-H06-B02 - Estimate 5.4.6b|Markov Chain Estimate 5.4.6b]] · 马尔可夫链估计 5.4.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch05-S04-H06-B03 - Example 5.4.6c|Markov Chain Example 5.4.6c]] · 马尔可夫链例子 5.4.6c · `⇠ 3` · `∑` · `◌`

## Ch06 · Spectral Theory

> [!chapter]+ 🟡 *谱理论* · [[Ch06 - Spectral Theory|Spectral Theory]] · `67` · исходящих `5`
>
> > [!section]+ 🔵 `Ch06-S01` · [[Ch06-S01 - Setup and Notation|Setup and Notation — Spectral Theory]] · 谱理论：预备知识与记号 · `⇠ 41` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S01-H01 - Definition Vector Space|Definition: Vector Space]] · 向量空间：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch06-S01-H01-B01 - Proposition 6.1.1a|Vector Space Proposition 6.1.1a]] · 向量空间命题 6.1.1a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch06-S01-H01-B02 - Identity 6.1.1b|Vector Space Identity 6.1.1b]] · 向量空间恒等式 6.1.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch06-S01-H01-B03 - Estimate 6.1.1c|Vector Space Estimate 6.1.1c]] · 向量空间估计 6.1.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S01-H01-B04 - Example 6.1.1d|Vector Space Example 6.1.1d]] · 向量空间例子 6.1.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S01-H02 - Notation Linear Operator|Notation: Linear Operator]] · 线性算子：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch06-S01-H02-B01 - Identity 6.1.2a|Linear Operator Identity 6.1.2a]] · 线性算子恒等式 6.1.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch06-S01-H02-B02 - Estimate 6.1.2b|Linear Operator Estimate 6.1.2b]] · 线性算子估计 6.1.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S01-H02-B03 - Example 6.1.2c|Linear Operator Example 6.1.2c]] · 线性算子例子 6.1.2c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S01-H03 - Basic Properties Compact Set|Basic Properties: Compact Set]] · 紧集：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch06-S01-H03-B01 - Estimate 6.1.3a|Compact Set Estimate 6.1.3a]] · 紧集估计 6.1.3a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch06-S01-H03-B02 - Example 6.1.3b|Compact Set Example 6.1.3b]] · 紧集例子 6.1.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S01-H03-B03 - Proposition 6.1.3c|Compact Set Proposition 6.1.3c]] · 紧集命题 6.1.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch06-S01-H03-B04 - Identity 6.1.3d|Compact Set Identity 6.1.3d]] · 紧集恒等式 6.1.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S01-H04 - Key Lemma Metric Completion|Key Lemma: Metric Completion]] · 度量完备化：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch06-S01-H04-B01 - Example 6.1.4a|Metric Completion Example 6.1.4a]] · 度量完备化例子 6.1.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch06-S01-H04-B02 - Proposition 6.1.4b|Metric Completion Proposition 6.1.4b]] · 度量完备化命题 6.1.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch06-S01-H04-B03 - Identity 6.1.4c|Metric Completion Identity 6.1.4c]] · 度量完备化恒等式 6.1.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S01-H05 - Main Theorem Orthogonal Projection|Main Theorem: Orthogonal Projection]] · 正交投影：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch06-S01-H05-B01 - Proposition 6.1.5a|Orthogonal Projection Proposition 6.1.5a]] · 正交投影命题 6.1.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch06-S01-H05-B02 - Identity 6.1.5b|Orthogonal Projection Identity 6.1.5b]] · 正交投影恒等式 6.1.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch06-S01-H05-B03 - Estimate 6.1.5c|Orthogonal Projection Estimate 6.1.5c]] · 正交投影估计 6.1.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch06-S01-H05-B04 - Example 6.1.5d|Orthogonal Projection Example 6.1.5d]] · 正交投影例子 6.1.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S01-H06 - Proof and Consequences Basis and Coordinates|Proof and Consequences: Basis and Coordinates]] · 基与坐标：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch06-S01-H06-B01 - Identity 6.1.6a|Basis and Coordinates Identity 6.1.6a]] · 基与坐标恒等式 6.1.6a · `⇠ 11` · `∑` · `◌`
> > > > - [[Ch06-S01-H06-B02 - Estimate 6.1.6b|Basis and Coordinates Estimate 6.1.6b]] · 基与坐标估计 6.1.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch06-S01-H06-B03 - Example 6.1.6c|Basis and Coordinates Example 6.1.6c]] · 基与坐标例子 6.1.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch06-S02` · [[Ch06-S02 - Core Theory|Core Theory — Spectral Theory]] · 谱理论：核心理论 · `⇠ 40` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S02-H01 - Definition Dual Space|Definition: Dual Space]] · 对偶空间：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch06-S02-H01-B01 - Proposition 6.2.1a|Dual Space Proposition 6.2.1a]] · 对偶空间命题 6.2.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch06-S02-H01-B02 - Identity 6.2.1b|Dual Space Identity 6.2.1b]] · 对偶空间恒等式 6.2.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S02-H01-B03 - Estimate 6.2.1c|Dual Space Estimate 6.2.1c]] · 对偶空间估计 6.2.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch06-S02-H01-B04 - Example 6.2.1d|Dual Space Example 6.2.1d]] · 对偶空间例子 6.2.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S02-H02 - Notation Adjoint Operator|Notation: Adjoint Operator]] · 伴随算子：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch06-S02-H02-B01 - Identity 6.2.2a|Adjoint Operator Identity 6.2.2a]] · 伴随算子恒等式 6.2.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch06-S02-H02-B02 - Estimate 6.2.2b|Adjoint Operator Estimate 6.2.2b]] · 伴随算子估计 6.2.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch06-S02-H02-B03 - Example 6.2.2c|Adjoint Operator Example 6.2.2c]] · 伴随算子例子 6.2.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S02-H03 - Basic Properties Spectral Theorem|Basic Properties: Spectral Theorem]] · 谱定理：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch06-S02-H03-B01 - Estimate 6.2.3a|Spectral Theorem Estimate 6.2.3a]] · 谱定理估计 6.2.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch06-S02-H03-B02 - Example 6.2.3b|Spectral Theorem Example 6.2.3b]] · 谱定理例子 6.2.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch06-S02-H03-B03 - Proposition 6.2.3c|Spectral Theorem Proposition 6.2.3c]] · 谱定理命题 6.2.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S02-H03-B04 - Identity 6.2.3d|Spectral Theorem Identity 6.2.3d]] · 谱定理恒等式 6.2.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S02-H04 - Key Lemma Norm Equivalence|Key Lemma: Norm Equivalence]] · 范数等价：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch06-S02-H04-B01 - Example 6.2.4a|Norm Equivalence Example 6.2.4a]] · 范数等价例子 6.2.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch06-S02-H04-B02 - Proposition 6.2.4b|Norm Equivalence Proposition 6.2.4b]] · 范数等价命题 6.2.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch06-S02-H04-B03 - Identity 6.2.4c|Norm Equivalence Identity 6.2.4c]] · 范数等价恒等式 6.2.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S02-H05 - Main Theorem Contraction Mapping|Main Theorem: Contraction Mapping]] · 压缩映射：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch06-S02-H05-B01 - Proposition 6.2.5a|Contraction Mapping Proposition 6.2.5a]] · 压缩映射命题 6.2.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch06-S02-H05-B02 - Identity 6.2.5b|Contraction Mapping Identity 6.2.5b]] · 压缩映射恒等式 6.2.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S02-H05-B03 - Estimate 6.2.5c|Contraction Mapping Estimate 6.2.5c]] · 压缩映射估计 6.2.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S02-H05-B04 - Example 6.2.5d|Contraction Mapping Example 6.2.5d]] · 压缩映射例子 6.2.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S02-H06 - Proof and Consequences Fixed Point|Proof and Consequences: Fixed Point]] · 不动点：证明与推论 · `⇠ 19` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch06-S02-H06-B01 - Identity 6.2.6a|Fixed Point Identity 6.2.6a]] · 不动点恒等式 6.2.6a · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S02-H06-B02 - Estimate 6.2.6b|Fixed Point Estimate 6.2.6b]] · 不动点估计 6.2.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S02-H06-B03 - Example 6.2.6c|Fixed Point Example 6.2.6c]] · 不动点例子 6.2.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch06-S03` · [[Ch06-S03 - Main Results|Main Results — Spectral Theory]] · 谱理论：主要结果 · `⇠ 24` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S03-H01 - Definition Banach Limit|Definition: Banach Limit]] · 巴拿赫极限：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch06-S03-H01-B01 - Proposition 6.3.1a|Banach Limit Proposition 6.3.1a]] · 巴拿赫极限命题 6.3.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch06-S03-H01-B02 - Identity 6.3.1b|Banach Limit Identity 6.3.1b]] · 巴拿赫极限恒等式 6.3.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch06-S03-H01-B03 - Estimate 6.3.1c|Banach Limit Estimate 6.3.1c]] · 巴拿赫极限估计 6.3.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S03-H01-B04 - Example 6.3.1d|Banach Limit Example 6.3.1d]] · 巴拿赫极限例子 6.3.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S03-H02 - Notation Hilbert Decomposition|Notation: Hilbert Decomposition]] · 希尔伯特分解：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch06-S03-H02-B01 - Identity 6.3.2a|Hilbert Decomposition Identity 6.3.2a]] · 希尔伯特分解恒等式 6.3.2a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch06-S03-H02-B02 - Estimate 6.3.2b|Hilbert Decomposition Estimate 6.3.2b]] · 希尔伯特分解估计 6.3.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S03-H02-B03 - Example 6.3.2c|Hilbert Decomposition Example 6.3.2c]] · 希尔伯特分解例子 6.3.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S03-H03 - Basic Properties Weak Convergence|Basic Properties: Weak Convergence]] · 弱收敛：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch06-S03-H03-B01 - Estimate 6.3.3a|Weak Convergence Estimate 6.3.3a]] · 弱收敛估计 6.3.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch06-S03-H03-B02 - Example 6.3.3b|Weak Convergence Example 6.3.3b]] · 弱收敛例子 6.3.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S03-H03-B03 - Proposition 6.3.3c|Weak Convergence Proposition 6.3.3c]] · 弱收敛命题 6.3.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S03-H03-B04 - Identity 6.3.3d|Weak Convergence Identity 6.3.3d]] · 弱收敛恒等式 6.3.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S03-H04 - Key Lemma Density Argument|Key Lemma: Density Argument]] · 稠密性论证：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch06-S03-H04-B01 - Example 6.3.4a|Density Argument Example 6.3.4a]] · 稠密性论证例子 6.3.4a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch06-S03-H04-B02 - Proposition 6.3.4b|Density Argument Proposition 6.3.4b]] · 稠密性论证命题 6.3.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch06-S03-H04-B03 - Identity 6.3.4c|Density Argument Identity 6.3.4c]] · 稠密性论证恒等式 6.3.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S03-H05 - Main Theorem Kernel and Range|Main Theorem: Kernel and Range]] · 核与值域：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch06-S03-H05-B01 - Proposition 6.3.5a|Kernel and Range Proposition 6.3.5a]] · 核与值域命题 6.3.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch06-S03-H05-B02 - Identity 6.3.5b|Kernel and Range Identity 6.3.5b]] · 核与值域恒等式 6.3.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S03-H05-B03 - Estimate 6.3.5c|Kernel and Range Estimate 6.3.5c]] · 核与值域估计 6.3.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch06-S03-H05-B04 - Example 6.3.5d|Kernel and Range Example 6.3.5d]] · 核与值域例子 6.3.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S03-H06 - Proof and Consequences Eigenvalue Bounds|Proof and Consequences: Eigenvalue Bounds]] · 特征值估计：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch06-S03-H06-B01 - Identity 6.3.6a|Eigenvalue Bounds Identity 6.3.6a]] · 特征值估计恒等式 6.3.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch06-S03-H06-B02 - Estimate 6.3.6b|Eigenvalue Bounds Estimate 6.3.6b]] · 特征值估计估计 6.3.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch06-S03-H06-B03 - Example 6.3.6c|Eigenvalue Bounds Example 6.3.6c]] · 特征值估计例子 6.3.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch06-S04` · [[Ch06-S04 - Applications and Limits|Applications and Limits — Spectral Theory]] · 谱理论：应用与局限 · `⇠ 33` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S04-H01 - Definition Singular Values|Definition: Singular Values]] · 奇异值：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch06-S04-H01-B01 - Proposition 6.4.1a|Singular Values Proposition 6.4.1a]] · 奇异值命题 6.4.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch06-S04-H01-B02 - Identity 6.4.1b|Singular Values Identity 6.4.1b]] · 奇异值恒等式 6.4.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S04-H01-B03 - Estimate 6.4.1c|Singular Values Estimate 6.4.1c]] · 奇异值估计 6.4.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch06-S04-H01-B04 - Example 6.4.1d|Singular Values Example 6.4.1d]] · 奇异值例子 6.4.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S04-H02 - Notation Trace Class|Notation: Trace Class]] · 迹类：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch06-S04-H02-B01 - Identity 6.4.2a|Trace Class Identity 6.4.2a]] · 迹类恒等式 6.4.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch06-S04-H02-B02 - Estimate 6.4.2b|Trace Class Estimate 6.4.2b]] · 迹类估计 6.4.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch06-S04-H02-B03 - Example 6.4.2c|Trace Class Example 6.4.2c]] · 迹类例子 6.4.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S04-H03 - Basic Properties Convex Hull|Basic Properties: Convex Hull]] · 凸包：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch06-S04-H03-B01 - Estimate 6.4.3a|Convex Hull Estimate 6.4.3a]] · 凸包估计 6.4.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch06-S04-H03-B02 - Example 6.4.3b|Convex Hull Example 6.4.3b]] · 凸包例子 6.4.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch06-S04-H03-B03 - Proposition 6.4.3c|Convex Hull Proposition 6.4.3c]] · 凸包命题 6.4.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch06-S04-H03-B04 - Identity 6.4.3d|Convex Hull Identity 6.4.3d]] · 凸包恒等式 6.4.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S04-H04 - Key Lemma Separation Theorem|Key Lemma: Separation Theorem]] · 分离定理：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch06-S04-H04-B01 - Example 6.4.4a|Separation Theorem Example 6.4.4a]] · 分离定理例子 6.4.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch06-S04-H04-B02 - Proposition 6.4.4b|Separation Theorem Proposition 6.4.4b]] · 分离定理命题 6.4.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch06-S04-H04-B03 - Identity 6.4.4c|Separation Theorem Identity 6.4.4c]] · 分离定理恒等式 6.4.4c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S04-H05 - Main Theorem Hahn-Banach Extension|Main Theorem: Hahn-Banach Extension]] · 哈恩-巴拿赫延拓：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch06-S04-H05-B01 - Proposition 6.4.5a|Hahn-Banach Extension Proposition 6.4.5a]] · 哈恩-巴拿赫延拓命题 6.4.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch06-S04-H05-B02 - Identity 6.4.5b|Hahn-Banach Extension Identity 6.4.5b]] · 哈恩-巴拿赫延拓恒等式 6.4.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch06-S04-H05-B03 - Estimate 6.4.5c|Hahn-Banach Extension Estimate 6.4.5c]] · 哈恩-巴拿赫延拓估计 6.4.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S04-H05-B04 - Example 6.4.5d|Hahn-Banach Extension Example 6.4.5d]] · 哈恩-巴拿赫延拓例子 6.4.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch06-S04-H06 - Proof and Consequences Open Mapping|Proof and Consequences: Open Mapping]] · 开映射：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch06-S04-H06-B01 - Identity 6.4.6a|Open Mapping Identity 6.4.6a]] · 开映射恒等式 6.4.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch06-S04-H06-B02 - Estimate 6.4.6b|Open Mapping Estimate 6.4.6b]] · 开映射估计 6.4.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch06-S04-H06-B03 - Example 6.4.6c|Open Mapping Example 6.4.6c]] · 开映射例子 6.4.6c · `⇠ 51` · `∑` · `◌`

## Ch07 · Convexity and Duality

> [!chapter]+ 🟡 *凸性与对偶性* · [[Ch07 - Convexity and Duality|Convexity and Duality]] · `62` · исходящих `5`
>
> > [!section]+ 🔵 `Ch07-S01` · [[Ch07-S01 - Setup and Notation|Setup and Notation — Convexity and Duality]] · 凸性与对偶性：预备知识与记号 · `⇠ 40` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S01-H01 - Definition Closed Graph|Definition: Closed Graph]] · 闭图像：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch07-S01-H01-B01 - Proposition 7.1.1a|Closed Graph Proposition 7.1.1a]] · 闭图像命题 7.1.1a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch07-S01-H01-B02 - Identity 7.1.1b|Closed Graph Identity 7.1.1b]] · 闭图像恒等式 7.1.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch07-S01-H01-B03 - Estimate 7.1.1c|Closed Graph Estimate 7.1.1c]] · 闭图像估计 7.1.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S01-H01-B04 - Example 7.1.1d|Closed Graph Example 7.1.1d]] · 闭图像例子 7.1.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S01-H02 - Notation Uniform Boundedness|Notation: Uniform Boundedness]] · 一致有界性：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch07-S01-H02-B01 - Identity 7.1.2a|Uniform Boundedness Identity 7.1.2a]] · 一致有界性恒等式 7.1.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch07-S01-H02-B02 - Estimate 7.1.2b|Uniform Boundedness Estimate 7.1.2b]] · 一致有界性估计 7.1.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S01-H02-B03 - Example 7.1.2c|Uniform Boundedness Example 7.1.2c]] · 一致有界性例子 7.1.2c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S01-H03 - Basic Properties Approximation Error|Basic Properties: Approximation Error]] · 逼近误差：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch07-S01-H03-B01 - Estimate 7.1.3a|Approximation Error Estimate 7.1.3a]] · 逼近误差估计 7.1.3a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch07-S01-H03-B02 - Example 7.1.3b|Approximation Error Example 7.1.3b]] · 逼近误差例子 7.1.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S01-H03-B03 - Proposition 7.1.3c|Approximation Error Proposition 7.1.3c]] · 逼近误差命题 7.1.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch07-S01-H03-B04 - Identity 7.1.3d|Approximation Error Identity 7.1.3d]] · 逼近误差恒等式 7.1.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S01-H04 - Key Lemma Radon-Nikodym Derivative|Key Lemma: Radon-Nikodym Derivative]] · 拉东-尼科迪姆导数：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch07-S01-H04-B01 - Example 7.1.4a|Radon-Nikodym Derivative Example 7.1.4a]] · 拉东-尼科迪姆导数例子 7.1.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch07-S01-H04-B02 - Proposition 7.1.4b|Radon-Nikodym Derivative Proposition 7.1.4b]] · 拉东-尼科迪姆导数命题 7.1.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch07-S01-H04-B03 - Identity 7.1.4c|Radon-Nikodym Derivative Identity 7.1.4c]] · 拉东-尼科迪姆导数恒等式 7.1.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S01-H05 - Main Theorem Entropy Bound|Main Theorem: Entropy Bound]] · 熵界：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch07-S01-H05-B01 - Proposition 7.1.5a|Entropy Bound Proposition 7.1.5a]] · 熵界命题 7.1.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch07-S01-H05-B02 - Identity 7.1.5b|Entropy Bound Identity 7.1.5b]] · 熵界恒等式 7.1.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch07-S01-H05-B03 - Estimate 7.1.5c|Entropy Bound Estimate 7.1.5c]] · 熵界估计 7.1.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch07-S01-H05-B04 - Example 7.1.5d|Entropy Bound Example 7.1.5d]] · 熵界例子 7.1.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S01-H06 - Proof and Consequences Concentration Inequality|Proof and Consequences: Concentration Inequality]] · 集中不等式：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch07-S01-H06-B01 - Identity 7.1.6a|Concentration Inequality Identity 7.1.6a]] · 集中不等式恒等式 7.1.6a · `⇠ 11` · `∑` · `◌`
> > > > - [[Ch07-S01-H06-B02 - Estimate 7.1.6b|Concentration Inequality Estimate 7.1.6b]] · 集中不等式估计 7.1.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch07-S01-H06-B03 - Example 7.1.6c|Concentration Inequality Example 7.1.6c]] · 集中不等式例子 7.1.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch07-S02` · [[Ch07-S02 - Core Theory|Core Theory — Convexity and Duality]] · 凸性与对偶性：核心理论 · `⇠ 52` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S02-H01 - Definition Gradient Descent|Definition: Gradient Descent]] · 梯度下降：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch07-S02-H01-B01 - Proposition 7.2.1a|Gradient Descent Proposition 7.2.1a]] · 梯度下降命题 7.2.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch07-S02-H01-B02 - Identity 7.2.1b|Gradient Descent Identity 7.2.1b]] · 梯度下降恒等式 7.2.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S02-H01-B03 - Estimate 7.2.1c|Gradient Descent Estimate 7.2.1c]] · 梯度下降估计 7.2.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch07-S02-H01-B04 - Example 7.2.1d|Gradient Descent Example 7.2.1d]] · 梯度下降例子 7.2.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S02-H02 - Notation Lipschitz Continuity|Notation: Lipschitz Continuity]] · 利普希茨连续性：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch07-S02-H02-B01 - Identity 7.2.2a|Lipschitz Continuity Identity 7.2.2a]] · 利普希茨连续性恒等式 7.2.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch07-S02-H02-B02 - Estimate 7.2.2b|Lipschitz Continuity Estimate 7.2.2b]] · 利普希茨连续性估计 7.2.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch07-S02-H02-B03 - Example 7.2.2c|Lipschitz Continuity Example 7.2.2c]] · 利普希茨连续性例子 7.2.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S02-H03 - Basic Properties Duality Gap|Basic Properties: Duality Gap]] · 对偶间隙：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch07-S02-H03-B01 - Estimate 7.2.3a|Duality Gap Estimate 7.2.3a]] · 对偶间隙估计 7.2.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch07-S02-H03-B02 - Example 7.2.3b|Duality Gap Example 7.2.3b]] · 对偶间隙例子 7.2.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch07-S02-H03-B03 - Proposition 7.2.3c|Duality Gap Proposition 7.2.3c]] · 对偶间隙命题 7.2.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S02-H03-B04 - Identity 7.2.3d|Duality Gap Identity 7.2.3d]] · 对偶间隙恒等式 7.2.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S02-H04 - Key Lemma Regularization|Key Lemma: Regularization]] · 正则化：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch07-S02-H04-B01 - Example 7.2.4a|Regularization Example 7.2.4a]] · 正则化例子 7.2.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch07-S02-H04-B02 - Proposition 7.2.4b|Regularization Proposition 7.2.4b]] · 正则化命题 7.2.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch07-S02-H04-B03 - Identity 7.2.4c|Regularization Identity 7.2.4c]] · 正则化恒等式 7.2.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S02-H05 - Main Theorem Feature Map|Main Theorem: Feature Map]] · 特征映射：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch07-S02-H05-B01 - Proposition 7.2.5a|Feature Map Proposition 7.2.5a]] · 特征映射命题 7.2.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch07-S02-H05-B02 - Identity 7.2.5b|Feature Map Identity 7.2.5b]] · 特征映射恒等式 7.2.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S02-H05-B03 - Estimate 7.2.5c|Feature Map Estimate 7.2.5c]] · 特征映射估计 7.2.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S02-H05-B04 - Example 7.2.5d|Feature Map Example 7.2.5d]] · 特征映射例子 7.2.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S02-H06 - Proof and Consequences Kernel Matrix|Proof and Consequences: Kernel Matrix]] · 核矩阵：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch07-S02-H06-B01 - Identity 7.2.6a|Kernel Matrix Identity 7.2.6a]] · 核矩阵恒等式 7.2.6a · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S02-H06-B02 - Estimate 7.2.6b|Kernel Matrix Estimate 7.2.6b]] · 核矩阵估计 7.2.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S02-H06-B03 - Example 7.2.6c|Kernel Matrix Example 7.2.6c]] · 核矩阵例子 7.2.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch07-S03` · [[Ch07-S03 - Main Results|Main Results — Convexity and Duality]] · 凸性与对偶性：主要结果 · `⇠ 26` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S03-H01 - Definition Sample Complexity|Definition: Sample Complexity]] · 样本复杂度：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch07-S03-H01-B01 - Proposition 7.3.1a|Sample Complexity Proposition 7.3.1a]] · 样本复杂度命题 7.3.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch07-S03-H01-B02 - Identity 7.3.1b|Sample Complexity Identity 7.3.1b]] · 样本复杂度恒等式 7.3.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch07-S03-H01-B03 - Estimate 7.3.1c|Sample Complexity Estimate 7.3.1c]] · 样本复杂度估计 7.3.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S03-H01-B04 - Example 7.3.1d|Sample Complexity Example 7.3.1d]] · 样本复杂度例子 7.3.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S03-H02 - Notation Generalization Bound|Notation: Generalization Bound]] · 泛化界：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch07-S03-H02-B01 - Identity 7.3.2a|Generalization Bound Identity 7.3.2a]] · 泛化界恒等式 7.3.2a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch07-S03-H02-B02 - Estimate 7.3.2b|Generalization Bound Estimate 7.3.2b]] · 泛化界估计 7.3.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S03-H02-B03 - Example 7.3.2c|Generalization Bound Example 7.3.2c]] · 泛化界例子 7.3.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S03-H03 - Basic Properties Spectral Gap|Basic Properties: Spectral Gap]] · 谱隙：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch07-S03-H03-B01 - Estimate 7.3.3a|Spectral Gap Estimate 7.3.3a]] · 谱隙估计 7.3.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch07-S03-H03-B02 - Example 7.3.3b|Spectral Gap Example 7.3.3b]] · 谱隙例子 7.3.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S03-H03-B03 - Proposition 7.3.3c|Spectral Gap Proposition 7.3.3c]] · 谱隙命题 7.3.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S03-H03-B04 - Identity 7.3.3d|Spectral Gap Identity 7.3.3d]] · 谱隙恒等式 7.3.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S03-H04 - Key Lemma Markov Chain|Key Lemma: Markov Chain]] · 马尔可夫链：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch07-S03-H04-B01 - Example 7.3.4a|Markov Chain Example 7.3.4a]] · 马尔可夫链例子 7.3.4a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch07-S03-H04-B02 - Proposition 7.3.4b|Markov Chain Proposition 7.3.4b]] · 马尔可夫链命题 7.3.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch07-S03-H04-B03 - Identity 7.3.4c|Markov Chain Identity 7.3.4c]] · 马尔可夫链恒等式 7.3.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S03-H05 - Main Theorem Vector Space|Main Theorem: Vector Space]] · 向量空间：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch07-S03-H05-B01 - Proposition 7.3.5a|Vector Space Proposition 7.3.5a]] · 向量空间命题 7.3.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch07-S03-H05-B02 - Identity 7.3.5b|Vector Space Identity 7.3.5b]] · 向量空间恒等式 7.3.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S03-H05-B03 - Estimate 7.3.5c|Vector Space Estimate 7.3.5c]] · 向量空间估计 7.3.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch07-S03-H05-B04 - Example 7.3.5d|Vector Space Example 7.3.5d]] · 向量空间例子 7.3.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S03-H06 - Proof and Consequences Linear Operator|Proof and Consequences: Linear Operator]] · 线性算子：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch07-S03-H06-B01 - Identity 7.3.6a|Linear Operator Identity 7.3.6a]] · 线性算子恒等式 7.3.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch07-S03-H06-B02 - Estimate 7.3.6b|Linear Operator Estimate 7.3.6b]] · 线性算子估计 7.3.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch07-S03-H06-B03 - Example 7.3.6c|Linear Operator Example 7.3.6c]] · 线性算子例子 7.3.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch07-S04` · [[Ch07-S04 - Applications and Limits|Applications and Limits — Convexity and Duality]] · 凸性与对偶性：应用与局限 · `⇠ 28` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S04-H01 - Definition Compact Set|Definition: Compact Set]] · 紧集：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch07-S04-H01-B01 - Proposition 7.4.1a|Compact Set Proposition 7.4.1a]] · 紧集命题 7.4.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch07-S04-H01-B02 - Identity 7.4.1b|Compact Set Identity 7.4.1b]] · 紧集恒等式 7.4.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S04-H01-B03 - Estimate 7.4.1c|Compact Set Estimate 7.4.1c]] · 紧集估计 7.4.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch07-S04-H01-B04 - Example 7.4.1d|Compact Set Example 7.4.1d]] · 紧集例子 7.4.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S04-H02 - Notation Metric Completion|Notation: Metric Completion]] · 度量完备化：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch07-S04-H02-B01 - Identity 7.4.2a|Metric Completion Identity 7.4.2a]] · 度量完备化恒等式 7.4.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch07-S04-H02-B02 - Estimate 7.4.2b|Metric Completion Estimate 7.4.2b]] · 度量完备化估计 7.4.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch07-S04-H02-B03 - Example 7.4.2c|Metric Completion Example 7.4.2c]] · 度量完备化例子 7.4.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S04-H03 - Basic Properties Orthogonal Projection|Basic Properties: Orthogonal Projection]] · 正交投影：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch07-S04-H03-B01 - Estimate 7.4.3a|Orthogonal Projection Estimate 7.4.3a]] · 正交投影估计 7.4.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch07-S04-H03-B02 - Example 7.4.3b|Orthogonal Projection Example 7.4.3b]] · 正交投影例子 7.4.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch07-S04-H03-B03 - Proposition 7.4.3c|Orthogonal Projection Proposition 7.4.3c]] · 正交投影命题 7.4.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch07-S04-H03-B04 - Identity 7.4.3d|Orthogonal Projection Identity 7.4.3d]] · 正交投影恒等式 7.4.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S04-H04 - Key Lemma Basis and Coordinates|Key Lemma: Basis and Coordinates]] · 基与坐标：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch07-S04-H04-B01 - Example 7.4.4a|Basis and Coordinates Example 7.4.4a]] · 基与坐标例子 7.4.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch07-S04-H04-B02 - Proposition 7.4.4b|Basis and Coordinates Proposition 7.4.4b]] · 基与坐标命题 7.4.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch07-S04-H04-B03 - Identity 7.4.4c|Basis and Coordinates Identity 7.4.4c]] · 基与坐标恒等式 7.4.4c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S04-H05 - Main Theorem Dual Space|Main Theorem: Dual Space]] · 对偶空间：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch07-S04-H05-B01 - Proposition 7.4.5a|Dual Space Proposition 7.4.5a]] · 对偶空间命题 7.4.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch07-S04-H05-B02 - Identity 7.4.5b|Dual Space Identity 7.4.5b]] · 对偶空间恒等式 7.4.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch07-S04-H05-B03 - Estimate 7.4.5c|Dual Space Estimate 7.4.5c]] · 对偶空间估计 7.4.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S04-H05-B04 - Example 7.4.5d|Dual Space Example 7.4.5d]] · 对偶空间例子 7.4.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch07-S04-H06 - Proof and Consequences Adjoint Operator|Proof and Consequences: Adjoint Operator]] · 伴随算子：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch07-S04-H06-B01 - Identity 7.4.6a|Adjoint Operator Identity 7.4.6a]] · 伴随算子恒等式 7.4.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch07-S04-H06-B02 - Estimate 7.4.6b|Adjoint Operator Estimate 7.4.6b]] · 伴随算子估计 7.4.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch07-S04-H06-B03 - Example 7.4.6c|Adjoint Operator Example 7.4.6c]] · 伴随算子例子 7.4.6c · `⇠ 3` · `∑` · `◌`

## Ch08 · Concentration and Probability

> [!chapter]+ 🟡 *集中性与概率* · [[Ch08 - Concentration and Probability|Concentration and Probability]] · `46` · исходящих `5`
>
> > [!section]+ 🔵 `Ch08-S01` · [[Ch08-S01 - Setup and Notation|Setup and Notation — Concentration and Probability]] · 集中性与概率：预备知识与记号 · `⇠ 36` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S01-H01 - Definition Spectral Theorem|Definition: Spectral Theorem]] · 谱定理：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch08-S01-H01-B01 - Proposition 8.1.1a|Spectral Theorem Proposition 8.1.1a]] · 谱定理命题 8.1.1a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch08-S01-H01-B02 - Identity 8.1.1b|Spectral Theorem Identity 8.1.1b]] · 谱定理恒等式 8.1.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch08-S01-H01-B03 - Estimate 8.1.1c|Spectral Theorem Estimate 8.1.1c]] · 谱定理估计 8.1.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S01-H01-B04 - Example 8.1.1d|Spectral Theorem Example 8.1.1d]] · 谱定理例子 8.1.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S01-H02 - Notation Norm Equivalence|Notation: Norm Equivalence]] · 范数等价：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch08-S01-H02-B01 - Identity 8.1.2a|Norm Equivalence Identity 8.1.2a]] · 范数等价恒等式 8.1.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch08-S01-H02-B02 - Estimate 8.1.2b|Norm Equivalence Estimate 8.1.2b]] · 范数等价估计 8.1.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S01-H02-B03 - Example 8.1.2c|Norm Equivalence Example 8.1.2c]] · 范数等价例子 8.1.2c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S01-H03 - Basic Properties Contraction Mapping|Basic Properties: Contraction Mapping]] · 压缩映射：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch08-S01-H03-B01 - Estimate 8.1.3a|Contraction Mapping Estimate 8.1.3a]] · 压缩映射估计 8.1.3a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch08-S01-H03-B02 - Example 8.1.3b|Contraction Mapping Example 8.1.3b]] · 压缩映射例子 8.1.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S01-H03-B03 - Proposition 8.1.3c|Contraction Mapping Proposition 8.1.3c]] · 压缩映射命题 8.1.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch08-S01-H03-B04 - Identity 8.1.3d|Contraction Mapping Identity 8.1.3d]] · 压缩映射恒等式 8.1.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S01-H04 - Key Lemma Fixed Point|Key Lemma: Fixed Point]] · 不动点：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch08-S01-H04-B01 - Example 8.1.4a|Fixed Point Example 8.1.4a]] · 不动点例子 8.1.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch08-S01-H04-B02 - Proposition 8.1.4b|Fixed Point Proposition 8.1.4b]] · 不动点命题 8.1.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch08-S01-H04-B03 - Identity 8.1.4c|Fixed Point Identity 8.1.4c]] · 不动点恒等式 8.1.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S01-H05 - Main Theorem Banach Limit|Main Theorem: Banach Limit]] · 巴拿赫极限：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch08-S01-H05-B01 - Proposition 8.1.5a|Banach Limit Proposition 8.1.5a]] · 巴拿赫极限命题 8.1.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch08-S01-H05-B02 - Identity 8.1.5b|Banach Limit Identity 8.1.5b]] · 巴拿赫极限恒等式 8.1.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch08-S01-H05-B03 - Estimate 8.1.5c|Banach Limit Estimate 8.1.5c]] · 巴拿赫极限估计 8.1.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch08-S01-H05-B04 - Example 8.1.5d|Banach Limit Example 8.1.5d]] · 巴拿赫极限例子 8.1.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S01-H06 - Proof and Consequences Hilbert Decomposition|Proof and Consequences: Hilbert Decomposition]] · 希尔伯特分解：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch08-S01-H06-B01 - Identity 8.1.6a|Hilbert Decomposition Identity 8.1.6a]] · 希尔伯特分解恒等式 8.1.6a · `⇠ 11` · `∑` · `◌`
> > > > - [[Ch08-S01-H06-B02 - Estimate 8.1.6b|Hilbert Decomposition Estimate 8.1.6b]] · 希尔伯特分解估计 8.1.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch08-S01-H06-B03 - Example 8.1.6c|Hilbert Decomposition Example 8.1.6c]] · 希尔伯特分解例子 8.1.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch08-S02` · [[Ch08-S02 - Core Theory|Core Theory — Concentration and Probability]] · 集中性与概率：核心理论 · `⇠ 24` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S02-H01 - Definition Weak Convergence|Definition: Weak Convergence]] · 弱收敛：定义 · `⇠ 17` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch08-S02-H01-B01 - Proposition 8.2.1a|Weak Convergence Proposition 8.2.1a]] · 弱收敛命题 8.2.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch08-S02-H01-B02 - Identity 8.2.1b|Weak Convergence Identity 8.2.1b]] · 弱收敛恒等式 8.2.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S02-H01-B03 - Estimate 8.2.1c|Weak Convergence Estimate 8.2.1c]] · 弱收敛估计 8.2.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch08-S02-H01-B04 - Example 8.2.1d|Weak Convergence Example 8.2.1d]] · 弱收敛例子 8.2.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S02-H02 - Notation Density Argument|Notation: Density Argument]] · 稠密性论证：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch08-S02-H02-B01 - Identity 8.2.2a|Density Argument Identity 8.2.2a]] · 稠密性论证恒等式 8.2.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch08-S02-H02-B02 - Estimate 8.2.2b|Density Argument Estimate 8.2.2b]] · 稠密性论证估计 8.2.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch08-S02-H02-B03 - Example 8.2.2c|Density Argument Example 8.2.2c]] · 稠密性论证例子 8.2.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S02-H03 - Basic Properties Kernel and Range|Basic Properties: Kernel and Range]] · 核与值域：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch08-S02-H03-B01 - Estimate 8.2.3a|Kernel and Range Estimate 8.2.3a]] · 核与值域估计 8.2.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch08-S02-H03-B02 - Example 8.2.3b|Kernel and Range Example 8.2.3b]] · 核与值域例子 8.2.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch08-S02-H03-B03 - Proposition 8.2.3c|Kernel and Range Proposition 8.2.3c]] · 核与值域命题 8.2.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S02-H03-B04 - Identity 8.2.3d|Kernel and Range Identity 8.2.3d]] · 核与值域恒等式 8.2.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S02-H04 - Key Lemma Eigenvalue Bounds|Key Lemma: Eigenvalue Bounds]] · 特征值估计：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch08-S02-H04-B01 - Example 8.2.4a|Eigenvalue Bounds Example 8.2.4a]] · 特征值估计例子 8.2.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch08-S02-H04-B02 - Proposition 8.2.4b|Eigenvalue Bounds Proposition 8.2.4b]] · 特征值估计命题 8.2.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch08-S02-H04-B03 - Identity 8.2.4c|Eigenvalue Bounds Identity 8.2.4c]] · 特征值估计恒等式 8.2.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S02-H05 - Main Theorem Singular Values|Main Theorem: Singular Values]] · 奇异值：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch08-S02-H05-B01 - Proposition 8.2.5a|Singular Values Proposition 8.2.5a]] · 奇异值命题 8.2.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch08-S02-H05-B02 - Identity 8.2.5b|Singular Values Identity 8.2.5b]] · 奇异值恒等式 8.2.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S02-H05-B03 - Estimate 8.2.5c|Singular Values Estimate 8.2.5c]] · 奇异值估计 8.2.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S02-H05-B04 - Example 8.2.5d|Singular Values Example 8.2.5d]] · 奇异值例子 8.2.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S02-H06 - Proof and Consequences Trace Class|Proof and Consequences: Trace Class]] · 迹类：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch08-S02-H06-B01 - Identity 8.2.6a|Trace Class Identity 8.2.6a]] · 迹类恒等式 8.2.6a · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S02-H06-B02 - Estimate 8.2.6b|Trace Class Estimate 8.2.6b]] · 迹类估计 8.2.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S02-H06-B03 - Example 8.2.6c|Trace Class Example 8.2.6c]] · 迹类例子 8.2.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch08-S03` · [[Ch08-S03 - Main Results|Main Results — Concentration and Probability]] · 集中性与概率：主要结果 · `⇠ 21` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S03-H01 - Definition Convex Hull|Definition: Convex Hull]] · 凸包：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch08-S03-H01-B01 - Proposition 8.3.1a|Convex Hull Proposition 8.3.1a]] · 凸包命题 8.3.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch08-S03-H01-B02 - Identity 8.3.1b|Convex Hull Identity 8.3.1b]] · 凸包恒等式 8.3.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch08-S03-H01-B03 - Estimate 8.3.1c|Convex Hull Estimate 8.3.1c]] · 凸包估计 8.3.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S03-H01-B04 - Example 8.3.1d|Convex Hull Example 8.3.1d]] · 凸包例子 8.3.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S03-H02 - Notation Separation Theorem|Notation: Separation Theorem]] · 分离定理：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch08-S03-H02-B01 - Identity 8.3.2a|Separation Theorem Identity 8.3.2a]] · 分离定理恒等式 8.3.2a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch08-S03-H02-B02 - Estimate 8.3.2b|Separation Theorem Estimate 8.3.2b]] · 分离定理估计 8.3.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S03-H02-B03 - Example 8.3.2c|Separation Theorem Example 8.3.2c]] · 分离定理例子 8.3.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S03-H03 - Basic Properties Hahn-Banach Extension|Basic Properties: Hahn-Banach Extension]] · 哈恩-巴拿赫延拓：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch08-S03-H03-B01 - Estimate 8.3.3a|Hahn-Banach Extension Estimate 8.3.3a]] · 哈恩-巴拿赫延拓估计 8.3.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch08-S03-H03-B02 - Example 8.3.3b|Hahn-Banach Extension Example 8.3.3b]] · 哈恩-巴拿赫延拓例子 8.3.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S03-H03-B03 - Proposition 8.3.3c|Hahn-Banach Extension Proposition 8.3.3c]] · 哈恩-巴拿赫延拓命题 8.3.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S03-H03-B04 - Identity 8.3.3d|Hahn-Banach Extension Identity 8.3.3d]] · 哈恩-巴拿赫延拓恒等式 8.3.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S03-H04 - Key Lemma Open Mapping|Key Lemma: Open Mapping]] · 开映射：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch08-S03-H04-B01 - Example 8.3.4a|Open Mapping Example 8.3.4a]] · 开映射例子 8.3.4a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch08-S03-H04-B02 - Proposition 8.3.4b|Open Mapping Proposition 8.3.4b]] · 开映射命题 8.3.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch08-S03-H04-B03 - Identity 8.3.4c|Open Mapping Identity 8.3.4c]] · 开映射恒等式 8.3.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S03-H05 - Main Theorem Closed Graph|Main Theorem: Closed Graph]] · 闭图像：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch08-S03-H05-B01 - Proposition 8.3.5a|Closed Graph Proposition 8.3.5a]] · 闭图像命题 8.3.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch08-S03-H05-B02 - Identity 8.3.5b|Closed Graph Identity 8.3.5b]] · 闭图像恒等式 8.3.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S03-H05-B03 - Estimate 8.3.5c|Closed Graph Estimate 8.3.5c]] · 闭图像估计 8.3.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch08-S03-H05-B04 - Example 8.3.5d|Closed Graph Example 8.3.5d]] · 闭图像例子 8.3.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S03-H06 - Proof and Consequences Uniform Boundedness|Proof and Consequences: Uniform Boundedness]] · 一致有界性：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch08-S03-H06-B01 - Identity 8.3.6a|Uniform Boundedness Identity 8.3.6a]] · 一致有界性恒等式 8.3.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch08-S03-H06-B02 - Estimate 8.3.6b|Uniform Boundedness Estimate 8.3.6b]] · 一致有界性估计 8.3.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch08-S03-H06-B03 - Example 8.3.6c|Uniform Boundedness Example 8.3.6c]] · 一致有界性例子 8.3.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch08-S04` · [[Ch08-S04 - Applications and Limits|Applications and Limits — Concentration and Probability]] · 集中性与概率：应用与局限 · `⇠ 33` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S04-H01 - Definition Approximation Error|Definition: Approximation Error]] · 逼近误差：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch08-S04-H01-B01 - Proposition 8.4.1a|Approximation Error Proposition 8.4.1a]] · 逼近误差命题 8.4.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch08-S04-H01-B02 - Identity 8.4.1b|Approximation Error Identity 8.4.1b]] · 逼近误差恒等式 8.4.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S04-H01-B03 - Estimate 8.4.1c|Approximation Error Estimate 8.4.1c]] · 逼近误差估计 8.4.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch08-S04-H01-B04 - Example 8.4.1d|Approximation Error Example 8.4.1d]] · 逼近误差例子 8.4.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S04-H02 - Notation Radon-Nikodym Derivative|Notation: Radon-Nikodym Derivative]] · 拉东-尼科迪姆导数：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch08-S04-H02-B01 - Identity 8.4.2a|Radon-Nikodym Derivative Identity 8.4.2a]] · 拉东-尼科迪姆导数恒等式 8.4.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch08-S04-H02-B02 - Estimate 8.4.2b|Radon-Nikodym Derivative Estimate 8.4.2b]] · 拉东-尼科迪姆导数估计 8.4.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch08-S04-H02-B03 - Example 8.4.2c|Radon-Nikodym Derivative Example 8.4.2c]] · 拉东-尼科迪姆导数例子 8.4.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S04-H03 - Basic Properties Entropy Bound|Basic Properties: Entropy Bound]] · 熵界：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch08-S04-H03-B01 - Estimate 8.4.3a|Entropy Bound Estimate 8.4.3a]] · 熵界估计 8.4.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch08-S04-H03-B02 - Example 8.4.3b|Entropy Bound Example 8.4.3b]] · 熵界例子 8.4.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch08-S04-H03-B03 - Proposition 8.4.3c|Entropy Bound Proposition 8.4.3c]] · 熵界命题 8.4.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch08-S04-H03-B04 - Identity 8.4.3d|Entropy Bound Identity 8.4.3d]] · 熵界恒等式 8.4.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S04-H04 - Key Lemma Concentration Inequality|Key Lemma: Concentration Inequality]] · 集中不等式：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch08-S04-H04-B01 - Example 8.4.4a|Concentration Inequality Example 8.4.4a]] · 集中不等式例子 8.4.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch08-S04-H04-B02 - Proposition 8.4.4b|Concentration Inequality Proposition 8.4.4b]] · 集中不等式命题 8.4.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch08-S04-H04-B03 - Identity 8.4.4c|Concentration Inequality Identity 8.4.4c]] · 集中不等式恒等式 8.4.4c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S04-H05 - Main Theorem Gradient Descent|Main Theorem: Gradient Descent]] · 梯度下降：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch08-S04-H05-B01 - Proposition 8.4.5a|Gradient Descent Proposition 8.4.5a]] · 梯度下降命题 8.4.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch08-S04-H05-B02 - Identity 8.4.5b|Gradient Descent Identity 8.4.5b]] · 梯度下降恒等式 8.4.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch08-S04-H05-B03 - Estimate 8.4.5c|Gradient Descent Estimate 8.4.5c]] · 梯度下降估计 8.4.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S04-H05-B04 - Example 8.4.5d|Gradient Descent Example 8.4.5d]] · 梯度下降例子 8.4.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch08-S04-H06 - Proof and Consequences Lipschitz Continuity|Proof and Consequences: Lipschitz Continuity]] · 利普希茨连续性：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch08-S04-H06-B01 - Identity 8.4.6a|Lipschitz Continuity Identity 8.4.6a]] · 利普希茨连续性恒等式 8.4.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch08-S04-H06-B02 - Estimate 8.4.6b|Lipschitz Continuity Estimate 8.4.6b]] · 利普希茨连续性估计 8.4.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch08-S04-H06-B03 - Example 8.4.6c|Lipschitz Continuity Example 8.4.6c]] · 利普希茨连续性例子 8.4.6c · `⇠ 3` · `∑` · `◌`

## Ch09 · Learning Theory and Regularization

> [!chapter]+ 🟡 *学习理论与正则化* · [[Ch09 - Learning Theory and Regularization|Learning Theory and Regularization]] · `68` · исходящих `4`
>
> > [!section]+ 🔵 `Ch09-S01` · [[Ch09-S01 - Setup and Notation|Setup and Notation — Learning Theory and Regularization]] · 学习理论与正则化：预备知识与记号 · `⇠ 33` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S01-H01 - Definition Duality Gap|Definition: Duality Gap]] · 对偶间隙：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch09-S01-H01-B01 - Proposition 9.1.1a|Duality Gap Proposition 9.1.1a]] · 对偶间隙命题 9.1.1a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch09-S01-H01-B02 - Identity 9.1.1b|Duality Gap Identity 9.1.1b]] · 对偶间隙恒等式 9.1.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch09-S01-H01-B03 - Estimate 9.1.1c|Duality Gap Estimate 9.1.1c]] · 对偶间隙估计 9.1.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S01-H01-B04 - Example 9.1.1d|Duality Gap Example 9.1.1d]] · 对偶间隙例子 9.1.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S01-H02 - Notation Regularization|Notation: Regularization]] · 正则化：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch09-S01-H02-B01 - Identity 9.1.2a|Regularization Identity 9.1.2a]] · 正则化恒等式 9.1.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch09-S01-H02-B02 - Estimate 9.1.2b|Regularization Estimate 9.1.2b]] · 正则化估计 9.1.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S01-H02-B03 - Example 9.1.2c|Regularization Example 9.1.2c]] · 正则化例子 9.1.2c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S01-H03 - Basic Properties Feature Map|Basic Properties: Feature Map]] · 特征映射：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch09-S01-H03-B01 - Estimate 9.1.3a|Feature Map Estimate 9.1.3a]] · 特征映射估计 9.1.3a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch09-S01-H03-B02 - Example 9.1.3b|Feature Map Example 9.1.3b]] · 特征映射例子 9.1.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S01-H03-B03 - Proposition 9.1.3c|Feature Map Proposition 9.1.3c]] · 特征映射命题 9.1.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch09-S01-H03-B04 - Identity 9.1.3d|Feature Map Identity 9.1.3d]] · 特征映射恒等式 9.1.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S01-H04 - Key Lemma Kernel Matrix|Key Lemma: Kernel Matrix]] · 核矩阵：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch09-S01-H04-B01 - Example 9.1.4a|Kernel Matrix Example 9.1.4a]] · 核矩阵例子 9.1.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch09-S01-H04-B02 - Proposition 9.1.4b|Kernel Matrix Proposition 9.1.4b]] · 核矩阵命题 9.1.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch09-S01-H04-B03 - Identity 9.1.4c|Kernel Matrix Identity 9.1.4c]] · 核矩阵恒等式 9.1.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S01-H05 - Main Theorem Sample Complexity|Main Theorem: Sample Complexity]] · 样本复杂度：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch09-S01-H05-B01 - Proposition 9.1.5a|Sample Complexity Proposition 9.1.5a]] · 样本复杂度命题 9.1.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch09-S01-H05-B02 - Identity 9.1.5b|Sample Complexity Identity 9.1.5b]] · 样本复杂度恒等式 9.1.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch09-S01-H05-B03 - Estimate 9.1.5c|Sample Complexity Estimate 9.1.5c]] · 样本复杂度估计 9.1.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch09-S01-H05-B04 - Example 9.1.5d|Sample Complexity Example 9.1.5d]] · 样本复杂度例子 9.1.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S01-H06 - Proof and Consequences Generalization Bound|Proof and Consequences: Generalization Bound]] · 泛化界：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch09-S01-H06-B01 - Identity 9.1.6a|Generalization Bound Identity 9.1.6a]] · 泛化界恒等式 9.1.6a · `⇠ 11` · `∑` · `◌`
> > > > - [[Ch09-S01-H06-B02 - Estimate 9.1.6b|Generalization Bound Estimate 9.1.6b]] · 泛化界估计 9.1.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch09-S01-H06-B03 - Example 9.1.6c|Generalization Bound Example 9.1.6c]] · 泛化界例子 9.1.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch09-S02` · [[Ch09-S02 - Core Theory|Core Theory — Learning Theory and Regularization]] · 学习理论与正则化：核心理论 · `⇠ 32` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S02-H01 - Definition Spectral Gap|Definition: Spectral Gap]] · 谱隙：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch09-S02-H01-B01 - Proposition 9.2.1a|Spectral Gap Proposition 9.2.1a]] · 谱隙命题 9.2.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch09-S02-H01-B02 - Identity 9.2.1b|Spectral Gap Identity 9.2.1b]] · 谱隙恒等式 9.2.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S02-H01-B03 - Estimate 9.2.1c|Spectral Gap Estimate 9.2.1c]] · 谱隙估计 9.2.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch09-S02-H01-B04 - Example 9.2.1d|Spectral Gap Example 9.2.1d]] · 谱隙例子 9.2.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S02-H02 - Notation Markov Chain|Notation: Markov Chain]] · 马尔可夫链：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch09-S02-H02-B01 - Identity 9.2.2a|Markov Chain Identity 9.2.2a]] · 马尔可夫链恒等式 9.2.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch09-S02-H02-B02 - Estimate 9.2.2b|Markov Chain Estimate 9.2.2b]] · 马尔可夫链估计 9.2.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch09-S02-H02-B03 - Example 9.2.2c|Markov Chain Example 9.2.2c]] · 马尔可夫链例子 9.2.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S02-H03 - Basic Properties Vector Space|Basic Properties: Vector Space]] · 向量空间：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch09-S02-H03-B01 - Estimate 9.2.3a|Vector Space Estimate 9.2.3a]] · 向量空间估计 9.2.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch09-S02-H03-B02 - Example 9.2.3b|Vector Space Example 9.2.3b]] · 向量空间例子 9.2.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch09-S02-H03-B03 - Proposition 9.2.3c|Vector Space Proposition 9.2.3c]] · 向量空间命题 9.2.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S02-H03-B04 - Identity 9.2.3d|Vector Space Identity 9.2.3d]] · 向量空间恒等式 9.2.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S02-H04 - Key Lemma Linear Operator|Key Lemma: Linear Operator]] · 线性算子：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch09-S02-H04-B01 - Example 9.2.4a|Linear Operator Example 9.2.4a]] · 线性算子例子 9.2.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch09-S02-H04-B02 - Proposition 9.2.4b|Linear Operator Proposition 9.2.4b]] · 线性算子命题 9.2.4b · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch09-S02-H04-B03 - Identity 9.2.4c|Linear Operator Identity 9.2.4c]] · 线性算子恒等式 9.2.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S02-H05 - Main Theorem Compact Set|Main Theorem: Compact Set]] · 紧集：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch09-S02-H05-B01 - Proposition 9.2.5a|Compact Set Proposition 9.2.5a]] · 紧集命题 9.2.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch09-S02-H05-B02 - Identity 9.2.5b|Compact Set Identity 9.2.5b]] · 紧集恒等式 9.2.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S02-H05-B03 - Estimate 9.2.5c|Compact Set Estimate 9.2.5c]] · 紧集估计 9.2.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S02-H05-B04 - Example 9.2.5d|Compact Set Example 9.2.5d]] · 紧集例子 9.2.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S02-H06 - Proof and Consequences Metric Completion|Proof and Consequences: Metric Completion]] · 度量完备化：证明与推论 · `⇠ 12` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch09-S02-H06-B01 - Identity 9.2.6a|Metric Completion Identity 9.2.6a]] · 度量完备化恒等式 9.2.6a · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S02-H06-B02 - Estimate 9.2.6b|Metric Completion Estimate 9.2.6b]] · 度量完备化估计 9.2.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S02-H06-B03 - Example 9.2.6c|Metric Completion Example 9.2.6c]] · 度量完备化例子 9.2.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch09-S03` · [[Ch09-S03 - Main Results|Main Results — Learning Theory and Regularization]] · 学习理论与正则化：主要结果 · `⇠ 31` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S03-H01 - Definition Orthogonal Projection|Definition: Orthogonal Projection]] · 正交投影：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch09-S03-H01-B01 - Proposition 9.3.1a|Orthogonal Projection Proposition 9.3.1a]] · 正交投影命题 9.3.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch09-S03-H01-B02 - Identity 9.3.1b|Orthogonal Projection Identity 9.3.1b]] · 正交投影恒等式 9.3.1b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch09-S03-H01-B03 - Estimate 9.3.1c|Orthogonal Projection Estimate 9.3.1c]] · 正交投影估计 9.3.1c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S03-H01-B04 - Example 9.3.1d|Orthogonal Projection Example 9.3.1d]] · 正交投影例子 9.3.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S03-H02 - Notation Basis and Coordinates|Notation: Basis and Coordinates]] · 基与坐标：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch09-S03-H02-B01 - Identity 9.3.2a|Basis and Coordinates Identity 9.3.2a]] · 基与坐标恒等式 9.3.2a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch09-S03-H02-B02 - Estimate 9.3.2b|Basis and Coordinates Estimate 9.3.2b]] · 基与坐标估计 9.3.2b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S03-H02-B03 - Example 9.3.2c|Basis and Coordinates Example 9.3.2c]] · 基与坐标例子 9.3.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S03-H03 - Basic Properties Dual Space|Basic Properties: Dual Space]] · 对偶空间：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch09-S03-H03-B01 - Estimate 9.3.3a|Dual Space Estimate 9.3.3a]] · 对偶空间估计 9.3.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch09-S03-H03-B02 - Example 9.3.3b|Dual Space Example 9.3.3b]] · 对偶空间例子 9.3.3b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S03-H03-B03 - Proposition 9.3.3c|Dual Space Proposition 9.3.3c]] · 对偶空间命题 9.3.3c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S03-H03-B04 - Identity 9.3.3d|Dual Space Identity 9.3.3d]] · 对偶空间恒等式 9.3.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S03-H04 - Key Lemma Adjoint Operator|Key Lemma: Adjoint Operator]] · 伴随算子：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch09-S03-H04-B01 - Example 9.3.4a|Adjoint Operator Example 9.3.4a]] · 伴随算子例子 9.3.4a · `⇠ 8` · `∑` · `◌`
> > > > - [[Ch09-S03-H04-B02 - Proposition 9.3.4b|Adjoint Operator Proposition 9.3.4b]] · 伴随算子命题 9.3.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch09-S03-H04-B03 - Identity 9.3.4c|Adjoint Operator Identity 9.3.4c]] · 伴随算子恒等式 9.3.4c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S03-H05 - Main Theorem Spectral Theorem|Main Theorem: Spectral Theorem]] · 谱定理：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch09-S03-H05-B01 - Proposition 9.3.5a|Spectral Theorem Proposition 9.3.5a]] · 谱定理命题 9.3.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch09-S03-H05-B02 - Identity 9.3.5b|Spectral Theorem Identity 9.3.5b]] · 谱定理恒等式 9.3.5b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S03-H05-B03 - Estimate 9.3.5c|Spectral Theorem Estimate 9.3.5c]] · 谱定理估计 9.3.5c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch09-S03-H05-B04 - Example 9.3.5d|Spectral Theorem Example 9.3.5d]] · 谱定理例子 9.3.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S03-H06 - Proof and Consequences Norm Equivalence|Proof and Consequences: Norm Equivalence]] · 范数等价：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch09-S03-H06-B01 - Identity 9.3.6a|Norm Equivalence Identity 9.3.6a]] · 范数等价恒等式 9.3.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch09-S03-H06-B02 - Estimate 9.3.6b|Norm Equivalence Estimate 9.3.6b]] · 范数等价估计 9.3.6b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch09-S03-H06-B03 - Example 9.3.6c|Norm Equivalence Example 9.3.6c]] · 范数等价例子 9.3.6c · `⇠ 4` · `∑` · `◌`
>
> > [!section]+ 🔵 `Ch09-S04` · [[Ch09-S04 - Applications and Limits|Applications and Limits — Learning Theory and Regularization]] · 学习理论与正则化：应用与局限 · `⇠ 41` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S04-H01 - Definition Contraction Mapping|Definition: Contraction Mapping]] · 压缩映射：定义 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch09-S04-H01-B01 - Proposition 9.4.1a|Contraction Mapping Proposition 9.4.1a]] · 压缩映射命题 9.4.1a · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch09-S04-H01-B02 - Identity 9.4.1b|Contraction Mapping Identity 9.4.1b]] · 压缩映射恒等式 9.4.1b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S04-H01-B03 - Estimate 9.4.1c|Contraction Mapping Estimate 9.4.1c]] · 压缩映射估计 9.4.1c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch09-S04-H01-B04 - Example 9.4.1d|Contraction Mapping Example 9.4.1d]] · 压缩映射例子 9.4.1d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S04-H02 - Notation Fixed Point|Notation: Fixed Point]] · 不动点：记号约定 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch09-S04-H02-B01 - Identity 9.4.2a|Fixed Point Identity 9.4.2a]] · 不动点恒等式 9.4.2a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch09-S04-H02-B02 - Estimate 9.4.2b|Fixed Point Estimate 9.4.2b]] · 不动点估计 9.4.2b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch09-S04-H02-B03 - Example 9.4.2c|Fixed Point Example 9.4.2c]] · 不动点例子 9.4.2c · `⇠ 4` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S04-H03 - Basic Properties Banach Limit|Basic Properties: Banach Limit]] · 巴拿赫极限：基本性质 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch09-S04-H03-B01 - Estimate 9.4.3a|Banach Limit Estimate 9.4.3a]] · 巴拿赫极限估计 9.4.3a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch09-S04-H03-B02 - Example 9.4.3b|Banach Limit Example 9.4.3b]] · 巴拿赫极限例子 9.4.3b · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch09-S04-H03-B03 - Proposition 9.4.3c|Banach Limit Proposition 9.4.3c]] · 巴拿赫极限命题 9.4.3c · `⇠ 5` · `∑` · `◌`
> > > > - [[Ch09-S04-H03-B04 - Identity 9.4.3d|Banach Limit Identity 9.4.3d]] · 巴拿赫极限恒等式 9.4.3d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S04-H04 - Key Lemma Hilbert Decomposition|Key Lemma: Hilbert Decomposition]] · 希尔伯特分解：关键引理 · `⇠ 10` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch09-S04-H04-B01 - Example 9.4.4a|Hilbert Decomposition Example 9.4.4a]] · 希尔伯特分解例子 9.4.4a · `⇠ 9` · `∑` · `◌`
> > > > - [[Ch09-S04-H04-B02 - Proposition 9.4.4b|Hilbert Decomposition Proposition 9.4.4b]] · 希尔伯特分解命题 9.4.4b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch09-S04-H04-B03 - Identity 9.4.4c|Hilbert Decomposition Identity 9.4.4c]] · 希尔伯特分解恒等式 9.4.4c · `⇠ 3` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S04-H05 - Main Theorem Weak Convergence|Main Theorem: Weak Convergence]] · 弱收敛：主定理 · `⇠ 11` · `◌`
> > >
> > > > [!block] 🟣 блоков · 4
> > > > - [[Ch09-S04-H05-B01 - Proposition 9.4.5a|Weak Convergence Proposition 9.4.5a]] · 弱收敛命题 9.4.5a · `⇠ 3` · `∑` · `◌`
> > > > - [[Ch09-S04-H05-B02 - Identity 9.4.5b|Weak Convergence Identity 9.4.5b]] · 弱收敛恒等式 9.4.5b · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch09-S04-H05-B03 - Estimate 9.4.5c|Weak Convergence Estimate 9.4.5c]] · 弱收敛估计 9.4.5c · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S04-H05-B04 - Example 9.4.5d|Weak Convergence Example 9.4.5d]] · 弱收敛例子 9.4.5d · `⇠ 2` · `∑` · `◌`
> >
> > > [!heading]+ 🟢 [[Ch09-S04-H06 - Proof and Consequences Density Argument|Proof and Consequences: Density Argument]] · 稠密性论证：证明与推论 · `⇠ 9` · `◌`
> > >
> > > > [!block] 🟣 блоков · 3
> > > > - [[Ch09-S04-H06-B01 - Identity 9.4.6a|Density Argument Identity 9.4.6a]] · 稠密性论证恒等式 9.4.6a · `⇠ 7` · `∑` · `◌`
> > > > - [[Ch09-S04-H06-B02 - Estimate 9.4.6b|Density Argument Estimate 9.4.6b]] · 稠密性论证估计 9.4.6b · `⇠ 6` · `∑` · `◌`
> > > > - [[Ch09-S04-H06-B03 - Example 9.4.6c|Density Argument Example 9.4.6c]] · 稠密性论证例子 9.4.6c · `⇠ 51` · `∑` · `◌`

## Топ-20 вершин по числу ссылок

| вершина | метка | тип | 中文 | `⇠` | тексты | структурные | врезки |
|---|---|---|---|--:|--:|--:|--:|
| [[Ch01 - Metric Spaces and Completion]] | Metric Spaces and Completion | chapter | 度量空间与完备化 | `160` | 160 | 4 | 0 |
| [[Ch05 - Hilbert Space Geometry]] | Hilbert Space Geometry | chapter | 希尔伯特空间几何 | `155` | 155 | 4 | 0 |
| [[Ch03 - Inner Products and Orthogonality]] | Inner Products and Orthogonality | chapter | 内积与正交性 | `148` | 148 | 4 | 0 |
| [[Ch02 - Normed Spaces and Operators]] | Normed Spaces and Operators | chapter | 赋范空间与算子 | `145` | 145 | 4 | 0 |
| [[Ch04 - Banach Space Theorems]] | Banach Space Theorems | chapter | 巴拿赫空间定理 | `138` | 138 | 4 | 0 |
| [[Ch04-S04-H01 - Definition Contraction Mapping]] | Definition: Contraction Mapping | heading | 压缩映射：定义 | `81` | 81 | 4 | 0 |
| [[Ch01-S01 - Setup and Notation]] | Setup and Notation — Metric Spaces and Completion | section | 度量空间与完备化：预备知识与记号 | `70` | 70 | 6 | 0 |
| [[Ch01-S01-H01-B01 - Proposition 1.1.1a]] | Vector Space Proposition 1.1.1a | block | 向量空间命题 1.1.1a | `69` | 69 | 0 | 0 |
| [[Ch04-S01-H01-B01 - Proposition 4.1.1a]] | Duality Gap Proposition 4.1.1a | block | 对偶间隙命题 4.1.1a | `69` | 69 | 0 | 0 |
| [[Ch09 - Learning Theory and Regularization]] | Learning Theory and Regularization | chapter | 学习理论与正则化 | `68` | 68 | 4 | 0 |
| [[Ch06 - Spectral Theory]] | Spectral Theory | chapter | 谱理论 | `67` | 67 | 4 | 0 |
| [[Ch01-S01-H01 - Definition Vector Space]] | Definition: Vector Space | heading | 向量空间：定义 | `66` | 66 | 4 | 0 |
| [[Ch07 - Convexity and Duality]] | Convexity and Duality | chapter | 凸性与对偶性 | `62` | 62 | 4 | 0 |
| [[Ch02-S03-H01 - Definition Sample Complexity]] | Definition: Sample Complexity | heading | 样本复杂度：定义 | `58` | 58 | 4 | 0 |
| [[Ch04-S03-H01 - Definition Orthogonal Projection]] | Definition: Orthogonal Projection | heading | 正交投影：定义 | `58` | 58 | 4 | 0 |
| [[Ch02-S03-H06 - Proof and Consequences Linear Operator]] | Proof and Consequences: Linear Operator | heading | 线性算子：证明与推论 | `57` | 57 | 3 | 0 |
| [[Ch02-S04-H01 - Definition Compact Set]] | Definition: Compact Set | heading | 紧集：定义 | `56` | 56 | 4 | 0 |
| [[Ch03-S04-H01 - Definition Approximation Error]] | Definition: Approximation Error | heading | 逼近误差：定义 | `56` | 56 | 4 | 0 |
| [[Ch04-S02-H01 - Definition Spectral Gap]] | Definition: Spectral Gap | heading | 谱隙：定义 | `55` | 55 | 4 | 0 |
| [[Ch01-S02-H01 - Definition Dual Space]] | Definition: Dual Space | heading | 对偶空间：定义 | `53` | 53 | 4 | 0 |

## Что починить

- вершин без единой входящей ссылки: **0** — изолированных нет, граф связный
- неразрешённых ссылок: **0**
- вершин без перевода (`name_zh` пуст): **0**
