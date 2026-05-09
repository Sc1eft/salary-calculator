#!/bin/bash
# Claude Code Stop Hook — 交付验收检查
# 当 Claude 结束本轮时检查代码、配置、文档是否已通过验证
# 如果修改了文件但没有验证记录，则不允许结束

# 只检查本轮（working tree）的修改
CHANGED=$(git diff --name-only HEAD 2>/dev/null)
if [ -z "$CHANGED" ]; then
  CHANGED=$(git diff --cached --name-only HEAD 2>/dev/null)
fi

# 没有文件改动 → 允许结束
if [ -z "$CHANGED" ]; then
  exit 0
fi

# 检查是否只改了非代码文件（如图片、gitignore 等）
ONLY_NON_CODE=true
for f in $CHANGED; do
  case "$f" in
    *.js|*.ts|*.jsx|*.tsx|*.py|*.go|*.rs|*.java|*.c|*.cpp|*.h|*.hpp)
      ONLY_NON_CODE=false ;;
    *.css|*.scss|*.less|*.html|*.htm)
      ONLY_NON_CODE=false ;;
    *.json|*.yaml|*.yml|*.toml)
      ONLY_NON_CODE=false ;;
    *.md|*.txt|*.cfg|*.conf|*.ini)
      ONLY_NON_CODE=false ;;
    Makefile|Dockerfile|*.dockerfile|*.sh|*.bat|*.ps1)
      ONLY_NON_CODE=false ;;
    *)
      ;;  # 其他文件视为非代码
  esac
done

if $ONLY_NON_CODE; then
  exit 0
fi

# 检查 diff 中是否有验证记录
# 用户或 Claude 可能在消息中提及验证结果，我们通过检查 diff 中新出现的验证关键词来判断
VERIFY_PATTERNS='test|lint|typecheck|type check|验证|测试|功能确认|TODO检查|todo check|验证通过|测试通过|验证完毕'

if echo "$CHANGED" | while read -r f; do
  git diff HEAD -- "$f" 2>/dev/null
done | grep -qiE "$VERIFY_PATTERNS"; then
  # diff 中包含验证关键词 → 允许结束
  exit 0
fi

# 检查最近一条 git log 是否包含验证信息
if git log -1 --pretty=%B 2>/dev/null | grep -qiE "$VERIFY_PATTERNS"; then
  exit 0
fi

# 没有验证记录 → 阻止结束
cat << 'EOF'
<user-prompt-submit-hook>
⚠️ **交付验收未通过**

本轮修改了代码/配置/文档，但未检测到以下验证记录：
- 测试 (test)
- Lint / TypeCheck
- 功能验证
- TODO检查

请继续完成验证，并将结果告知我。确认验证通过后即可结束。
</user-prompt-submit-hook>
EOF
