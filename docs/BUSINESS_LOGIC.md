# 业务逻辑说明

## 1. 产品目标

这个项目是一个 **AI-first 的商户支付入网工作台**，核心目标不是做一个静态表单，也不是做一个纯规则引擎，而是把商户 onboarding 拆成一条可审核、可补件、可确认的业务链路。

它要解决的业务问题是：

1. 先收集 processor-neutral 的公共入件信息
2. 收集 KYC / KYB readiness 和 supporting documents
3. 让 AI 结合规则上下文、网站、文档、商户答案做 underwriting review
4. 让 Admin 对 AI 结果进行确认或 override
5. 只在确认 processor 之后再问该 processor 的第二层问题
6. 最后让商户签约

系统里存在一些“规则”，但这些规则的职责不是做最终风控决策，而是：

- 决定 intake path
- 决定需要哪些 documents
- 生成 KYC / KYB readiness context
- 在 AI review 前做完整性检查

最终推荐必须来自 AI，不来自本地 rule-based underwriting。

## 2. 整体运行模式

系统分成两个主要工作面：

- Merchant Portal：商户填写 intake、上传文件、检查申请、查看状态、补 processor-specific follow-up、签 agreement
- Admin Portal：运营 / 审核人员查看申请、触发 AI review、检查 evidence、确认结果、发 notice、做 override

当前项目是单申请 demo，不是多租户正式系统。核心状态保存在浏览器 `localStorage`，而不是数据库。主要持久化内容包括：

- `appStatus`
- `merchantData`
- `documents`
- `merchantNoticeFromAdmin`
- `verificationIssues`
- `aiReview`

这意味着：

- 业务流程是完整的
- 存储方式是 demo 级的
- 系统目前默认只有一个活跃申请实例

## 3. 申请生命周期

申请状态只有 4 个：

1. `draft`
2. `under_review`
3. `approved`
4. `signed`

含义如下：

- `draft`：商户还在填写 intake
- `under_review`：商户已经提交，Admin 和 AI 正在审核
- `approved`：Admin 已经确认 approve 类动作，agreement 可签
- `signed`：商户已经签约完成

状态迁移规则：

1. Merchant 完成 intake 并提交 -> `under_review`
2. Admin 确认 `approve` 或 `approve_with_conditions` -> `approved`
3. Merchant 在 agreement 页面签字 -> `signed`

注意：

- `hold_for_review`
- `request_more_info`
- `decline`

都不会把状态推进到 `approved`。

## 4. Merchant 端业务流程

### 4.1 Intake 入口

Merchant 一进入系统，首先在 Intake Assistant 里完成前 5 个 anchor questions：

1. business type
2. country
3. industry
4. monthly volume
5. monthly transactions

这 5 个问题是整个业务链路的分流基础，因为它们会影响：

- 后续 intake path 怎么排
- 需要哪些 supporting documents
- KYC / KYB readiness 怎么解释
- AI 对 processor fit 的推断基础

### 4.2 AI Intake Planner

当 merchant 回答完前 5 个 anchor questions 以后，前端会调用 AI intake planner。

AI planner 会返回一个有顺序的 intake plan，plan 里的 section 类型只有三种：

- `common_form`
- `persona_gate`
- `document`

这一层的业务目标是：

- 保持 early intake processor-neutral
- 只问当前商户需要的问题
- 避免在 processor 还没确认之前就进入 processor-specific follow-up

如果 planner 不可用，系统只会 fallback 到默认收集顺序；这个 fallback 只负责“路径”，不负责“风控推荐”。

### 4.3 Common Intake

Common intake 是所有 processor 共用的基础层，主要覆盖：

- legal business information
- business model
- ownership and control
- processing history
- sales profile
- website / PCI basics
- document readiness

这一层的硬规则是：

- 在 common intake 阶段，不允许问 Nuvei / Payroc / Chase 专属问题

也就是说，系统先把商户共性的 underwriting 基础收齐，再决定 processor-specific 的第二层问题。

### 4.4 KYC / KYB Routing Context

Common intake 收完后，系统会生成一个 KYC / KYB routing context。

可能的 routing action 包括：

- `none`
- `kyb`
- `kyc`
- `both`
- `kyb_first`

这里的 routing context 不是最终决策，而是一个 readiness plan，用来回答：

- 要不要发 KYB
- 要不要发 KYC
- KYC 和 KYB 是否能一起发
- 部分 KYC 是否需要先 hold 住，等 KYB 或文档齐了再发

这个判断会依赖的字段包括：

- business entity type
- beneficial owners
- authorized signer
- parent-owned 结构
- non-owner control
- document readiness
- adverse processing history

输出结果会被保存成 merchant profile 里的 summary，供后面 AI 和 Admin 一起参考。

### 4.5 Document Collection

系统会根据商户 profile 自动计算出“期望文档清单”。

基础文档包括：

- business registration / certificate
- void cheque / bank letter
- recent business bank statements
- proof of address
- proof of ownership
- government-issued owner ID

在更复杂的 profile 下，会追加文档：

- `financials`：当前已经 processing、high volume、或者 high risk 时需要
- `complianceDocument`：high risk 时需要
- `enhancedVerification`：international 时需要

Merchant 可以在 intake 过程中上传，也可以在 `under_review` 阶段根据 Admin notice 再补。

### 4.6 AI Document Extraction

对特定 document slot，系统支持 AI 文档识别并生成字段建议。

支持的 slot 主要有：

- `idUpload`
- `registrationCertificate`
- `bankStatement`
- `proofOfAddress`

这一层的核心业务规则是：

- AI 只返回 suggested values
- Merchant 必须手动 Apply
- 系统不会静默覆盖已有数据

所以这层逻辑的角色是“辅助填表”，不是“自动改表”。

### 4.7 Review Application

Merchant 在提交之前会看到一个 review page，统一展示：

- business basics
- geography / industry
- owners / signer
- contact / address
- business model
- sales profile
- processing history
- website / PCI basics
- document readiness
- uploaded documents

这一步的业务目的很直接：

- 给商户一个最终确认页面
- 在进入 admin review 之前尽量减少明显遗漏

### 4.8 Submit for Review

Merchant 提交时，系统会做以下事：

1. `appStatus` 变成 `under_review`
2. `matchedProcessor` 和 processor-specific answers 被清空
3. Merchant 自动进入 status 页面
4. Admin workbench 可以开始 review

这里有一个关键业务规则：

- submit 不会本地生成最终 processor 推荐
- submit 不会本地生成 risk score
- submit 只是把申请送进 AI review 队列

### 4.9 Status 页面

在 `under_review` 阶段，merchant 会看到：

- application submitted
- review in progress
- admin notice（如果需要补件 / 补信息）
- 针对缺失 documents 的直接上传入口
- matched processor（只有 Admin 确认后才会出现）
- processor follow-up 入口

这个页面本质上是商户在 review 阶段的运营交互页。

### 4.10 Processor-specific Follow-up

只有当 processor routing 被确认之后，merchant 才会看到 processor-specific follow-up。

当前支持的 processor：

- Nuvei
- Payroc / Peoples
- Chase

每个 processor 有自己的第二层问题集，覆盖的内容包括：

- processor-specific underwriting 要求
- contact segmentation
- ownership 细节
- sales breakdown
- website / refund / fulfillment 细节
- banking 或 setup 细节

这一层的业务规则是：

- 只显示 matched processor 的问题
- 不重复 common intake

提交 follow-up 后，系统会生成一个 processor-ready package summary。

### 4.11 Agreement

当 Admin 确认 approve 类动作后，merchant 可以进入 agreement 页面。

Merchant 通过输入法定姓名完成签字。签字后：

- agreement 进入 signed 状态
- `appStatus` 变成 `signed`

## 5. App 侧规则与完整性逻辑

### 5.1 Persona Trigger Logic

系统会根据 common intake 计算一组 readiness flags，例如：

- 缺少 business registration 信息
- website gap
- business description 太弱
- recurring inconsistency
- termination history
- bankruptcy history
- risk program history
- ownership / control structure complexity

这些逻辑的作用不是做 underwriting 决策，而是回答 operational 问题：

- KYB 是否 required
- KYC 是否 required
- 是否可以一起发
- 是否要先 hold 某些 KYC
- 离“ready to send”还差什么

### 5.2 Local Verification Check

系统在 AI review 前后都会跑本地 verification check，用来审计完整性。

它会对两类对象提出 follow-up issue：

- intake sections
- document slots

典型问题包括：

- legal name / legal email / website 缺失
- owner details 不完整
- authorized signer 不完整
- website compliance basics 不完整
- document readiness 不完整
- high-risk compliance context 缺失
- crypto AML / KYC procedures 缺失
- high-volume ticket size 缺失
- international / high-risk merchant 缺少 target geography

输出结果只有两种：

- `clear`
- `needs_follow_up`

这个输出会被用于：

1. merchant 端补件 / 补信息提示
2. admin 端 evidence / readiness 展示
3. AI review context packet

### 5.3 Document Checklist

系统会根据 profile 动态生成 document checklist。

这份 checklist 贯穿多个环节：

- merchant 提示
- status 页提醒
- admin evidence 检查
- AI context packet

这里有一个重要业务思想：

- 缺少 evidence 不等于高风险
- 缺少 evidence 更应该触发 request for information，而不是自动 decline

## 6. AI 交互模型

系统和 AI 的交互分成三层，而且职责严格分开。

### 6.1 AI Intake Planner

目的：

- 在前 5 个 anchor questions 之后决定 intake path

输入：

- anchor answers
- policy rules

输出：

- common forms 顺序
- persona gate 放置位置
- document slots 顺序

业务含义：

- AI 在这里负责“收集路径优化”
- 不负责最终 underwriting 结论

### 6.2 AI Document Extraction

目的：

- 读取单个上传文件，返回字段建议

输入：

- 选中的 document
- 所属 slot
- 已知 merchant context

输出：

- extracted suggestions
- confidence
- notes

业务含义：

- AI 用来辅助填表
- 最终数据写入仍由 merchant 控制

### 6.3 AI Underwriting Review

目的：

- 产出系统里唯一有效的 underwriting recommendation

输入包括：

1. 全量 `merchantData`
2. `aiContext`
3. 上传文档引用和可内联读取的文档内容
4. onboarding policy prompt

其中 `aiContext` 包含：

- workflow steps
- policy rules
- processor routing guide
- persona invite summary
- KYC / KYB readiness summary 与 issues
- document checklist 与 missing labels
- website signals

关键业务规则：

- `aiContext` 是 context，不是 recommendation
- app-side checks 不允许变成本地 risk score / local route / local approval

AI underwriting 的输出包括：

- `riskScore`
- `riskCategory`
- `recommendedProcessor`
- `confidence`
- `redFlags`
- `strengths`
- `recommendedAction`
- `adminNotes`
- `merchantMessage`
- `docConsistencyNotes`
- `evidenceCitations`

因此最终 underwriting recommendation 是：

- **AI 生成**
- **Admin 确认**

而不是本地规则直接决定。

## 7. Admin 端业务流程

### 7.1 Queue

Admin queue 展示当前申请的简要 triage 信息，例如：

- merchant identity
- document coverage
- AI state
- current application status

虽然当前 demo 只有一个 active application，但业务模型默认未来可以扩展到多 case 队列。

### 7.2 Open Workbench

Admin 打开 workbench 之后，系统会：

1. 刷新 readiness context（本地 verification）
2. 如果还没有 AI 结果，则自动触发 AI review

Workbench 里展示的内容包括：

- case overview
- AI verdict
- decision workflow / action plan
- evidence & reasoning
- advanced override

### 7.3 AI Verdict Handling

AI verdict 是 admin review 的核心推荐结果。

Admin 可以：

- confirm AI decision
- edit merchant message / processor 再 confirm
- re-run AI
- 检查 evidence 再决定

关键业务规则：

- 如果 AI 不可用，系统不会显示本地 fallback recommendation
- 最终 risk / route / action / merchant message 必须来自 AI

### 7.4 Confirm AI Decisions

AI 的 action 有：

- `approve`
- `approve_with_conditions`
- `hold_for_review`
- `request_more_info`
- `decline`

这些 action 的业务落地规则如下：

#### approve / approve_with_conditions

- 写入 `matchedProcessor`
- `appStatus` 变成 `approved`
- 可以把 merchant-facing message 发给商户

#### hold_for_review

- 不写入 processor route
- 不推进到 `approved`
- 可以通知 merchant，但本质上还是待人工处理

#### request_more_info

- 不写入 processor route
- 不推进到 `approved`
- 通知 merchant 补件 / 补充信息

#### decline

- 不写入 processor route
- demo 中记录 decline 动作

这意味着：

- processor fit 可以先作为 recommendation 存在
- 只有 approve 类动作被确认后，processor route 才真正 commit

### 7.5 Advanced Override

Admin 端保留少量高级 override 能力，包括：

- 手动给 merchant 发 notice
- 手动保存 KYC / KYB results
- 手动覆盖 processor
- force approve
- 查看 policy prompt

这部分的业务意义是：

- AI 是主路径
- human override 仍然存在，用于异常、争议和运营修正

## 8. Processor Routing 模型

系统当前支持三条 processor lane：

### 8.1 Nuvei

适用倾向：

- 标准 Canadian merchants
- KYC / KYB 比较干净
- 低到中等风险

### 8.2 Payroc / Peoples

适用倾向：

- adverse processing history
- 更高风险
- 需要人工 review 或 specialized underwriting

### 8.3 Chase

适用倾向：

- enterprise / 更大体量
- card-not-present 占比高
- advance-payment 风险
- ownership 结构更复杂
- international exposure

关键业务规则：

- app 会把这些 lane 作为 AI routing guide
- app 本身不会 deterministically assign 最终 processor

## 9. 系统里的关键不变量

这套业务逻辑里最重要的 10 条不变量是：

1. Common intake 必须 processor-neutral。
2. Processor-specific follow-up 只能在 routing 确认之后出现。
3. App-side checks 只能生成 context，不能生成最终 underwriting decision。
4. 最终 underwriting recommendation 只能来自 AI。
5. 最终对 merchant 生效的动作必须由 Admin 确认。
6. 非 approval 动作不能 commit processor route。
7. 缺失 evidence 应优先被视为 follow-up 问题，而不是直接高风险。
8. AI extraction suggestion 不能静默覆盖 merchant data。
9. Merchant 在 under review 阶段仍然可以补充 documents。
10. Agreement 只能在 approved 之后签。

## 10. 端到端流程总结

完整业务链路如下：

1. Merchant 进入 draft intake
2. Merchant 回答前 5 个 anchor questions
3. AI planner 决定 intake path
4. Merchant 完成 common intake
5. 系统生成 KYC / KYB readiness context
6. Merchant 上传 required / conditional documents
7. 可选地调用 AI extraction 返回字段建议
8. Merchant 在 review page 确认并提交
9. 申请进入 `under_review`
10. Admin 打开 workbench
11. 系统构建 readiness context 和 AI review context packet
12. AI 读取 intake、documents、website、policy context 并产出推荐
13. Admin 确认或 override AI decision
14. 如果是 approve 类动作，则 commit matched processor
15. Merchant 只补该 processor 的第二层 follow-up
16. Merchant 进入 agreement
17. Merchant 签字
18. 申请进入 `signed`

## 11. 一句话定义

这套系统最准确的定义是：

**一个以 AI 为核心推荐引擎、以结构化 intake 为输入、以 Admin 确认为最终落地动作的商户入网工作流。**
