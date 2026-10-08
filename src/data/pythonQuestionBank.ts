/**
 * 题库 — 统一题目仓库
 *
 * 架构约定：
 * - 所有题目统一归一化标签，标签即知识点的唯一标识
 * - 外部模块按标签搜索 → 按用户完成状态过滤 → 输出题目
 * - category: 'core' 为基础必学内容（~100题），'extension' 为扩展挑战
 * - Tag → questionId[] 倒排索引，O(1) 加速 AI 选题
 * - 错题集按学习阶段分组，支持关键词搜索
 */

import type { PracticeQuestion, PracticeState, TagScore } from '../types';
import type { CurrentPathStage } from '../services/learningOrchestrator';

// ==================== 标签规范 ====================
// syntax         — 语法基础（缩进、关键字、注释、命名规则）
// data-types     — 数据类型（int/str/list/tuple/dict/set/bool/None）
// operators      — 运算符（算术、比较、逻辑、赋值、优先级）
// control-flow   — 流程控制（if/elif/else、for、while、break/continue）
// functions      — 函数（定义、参数、返回值、lambda、一等对象）
// modules        — 模块与包（导入方式、__all__、搜索路径）
// scope          — 作用域（global、局部变量、闭包）
// OOP            — 面向对象基础（类/实例、self、构造方法）
// classes        — 类进阶（魔术方法、property、__slots__、单例）
// inheritance    — 继承（多继承、MRO、super、重写）
// polymorphism   — 多态（duck typing、重写、抽象）
// exceptions     — 异常处理（try/except/finally、自定义异常）
// files          — 文件操作（打开模式、with、读写方法）
// decorators     — 装饰器（无参/有参、叠加、wraps）
// comprehensions — 推导式（列表/字典/集合、条件过滤、嵌套）
// errorProne     — 易错点（可变默认参数、引用赋值、类型陷阱）
// studyHabit     — 学习习惯（缩进规范、调试、编码习惯）

// ==================== 学习计划 ====================

export interface ModuleMeta {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface LearningPlanMeta {
  id: string;
  name: string;
  description: string;
  modules: ModuleMeta[];
}

export const learningPlan: LearningPlanMeta = {
  id: 'python-basics',
  name: 'Python 编程基础',
  description: '系统学习 Python 编程，从语法基础到面向对象编程',
  modules: [
    {
      id: 'module-1',
      name: 'Python 基础语法',
      description: '变量、数据类型、运算符、流程控制',
      tags: ['syntax', 'data-types', 'operators', 'control-flow'],
    },
    {
      id: 'module-2',
      name: '函数与模块',
      description: '函数定义、参数传递、模块导入与使用',
      tags: ['functions', 'modules', 'scope', 'errorProne'],
    },
    {
      id: 'module-3',
      name: '面向对象编程',
      description: '类与对象、继承与多态、魔术方法',
      tags: ['OOP', 'classes', 'inheritance', 'polymorphism', 'errorProne'],
    },
    {
      id: 'module-4',
      name: '进阶与实战',
      description: '异常处理、文件操作、装饰器、推导式',
      tags: ['exceptions', 'files', 'decorators', 'comprehensions', 'errorProne', 'studyHabit'],
    },
  ],
};

// ==================== 全部题目 ====================

export const questions: PracticeQuestion[] = [

  // ═══════════════════ module-1: Python 基础语法 ═══════════════════

  // ----- 语法 (syntax) -----
  { id: 'q1', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['syntax'], question: 'Python 中变量在使用前必须先声明类型。', trueFalseAnswer: false, explanation: 'Python 是动态类型语言，变量无需声明类型。' },
  { id: 'q2', moduleId: 'module-1', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['syntax'], question: 'Python 中的 `elif` 可以替代 `else if` 使用，效果完全相同。', trueFalseAnswer: false, explanation: 'Python 使用 `elif` 关键字，而非 `else if`。' },
  { id: 'q3', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['syntax'], question: 'Python 使用缩进（indentation）来标识代码块。', trueFalseAnswer: true, explanation: 'Python 的代码块由缩进层级决定。' },
  { id: 'q4', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['syntax'], question: 'Python 中多条语句可以写在同一行，语句之间使用分号分隔。', trueFalseAnswer: true, explanation: 'Python 允许单行书写多条语句，用分号隔开，不推荐大量使用。' },
  { id: 'q5', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['syntax', 'errorProne'], question: 'Python 关键字可以被用作自定义变量名。', trueFalseAnswer: false, explanation: '关键字是语言预留词汇，不能作为变量名。' },
  { id: 'q6', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['syntax'], question: 'Python 多行注释可以使用三个单引号 \'\'\' 或者三个双引号 """。', trueFalseAnswer: true, explanation: '三引号是 Python 标准的多行注释写法。' },
  { id: 'q7', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['syntax', 'errorProne'], question: '变量名可以以数字作为开头。', trueFalseAnswer: false, explanation: '变量名首字符只能是字母或下划线。' },
  { id: 'q8', moduleId: 'module-1', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['syntax'], question: 'Python 区分大小写，变量 name 和 Name 是两个不同变量。', trueFalseAnswer: true, explanation: 'Python 是大小写敏感语言。' },
  { id: 'q9', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['syntax', 'errorProne'], question: 'Python 中括号、引号可以不配对使用。', trueFalseAnswer: false, explanation: '括号和引号必须成对出现，否则报语法错误。' },
  { id: 'q10', moduleId: 'module-1', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['syntax'], question: 'pass 语句是空语句，仅用于占位，不会执行任何操作。', trueFalseAnswer: true, explanation: 'pass 常用来补全语法结构。' },
  { id: 'q11', moduleId: 'module-1', type: 'short', difficulty: 'medium', category: 'core', tags: ['syntax', 'data-types'], question: '请说明 Python 中 `==` 和 `is` 的区别，并举例说明何时应该使用哪个。', sampleAnswer: '`==` 比较值相等，`is` 比较引用/身份。a=[1,2];b=[1,2]; a==b 为 True，a is b 为 False。推荐用 `is` 与 None 比较。', explanation: '`==` 调 __eq__，`is` 比较内存地址。' },
  { id: 'q12', moduleId: 'module-1', type: 'short', difficulty: 'medium', category: 'core', tags: ['syntax', 'control-flow'], question: 'Python 的 for 循环和 while 循环有什么区别？各适合什么场景？', sampleAnswer: 'for 用于遍历可迭代对象，适合已知次数；while 在条件为真时执行，适合不确定次数。', explanation: 'for 是确定循环，while 是不确定循环。' },

  // ----- 数据类型 (data-types) -----
  { id: 'q13', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['data-types'], question: '在 Python 中，list 是可变类型，tuple 是不可变类型。', trueFalseAnswer: true, explanation: 'list 支持修改操作，tuple 创建后不能修改。' },
  { id: 'q14', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['data-types'], question: '以下哪个不是 Python 的基本数据类型？', options: ['int', 'float', 'array', 'str'], correctAnswer: 'array', explanation: 'array 非内置基本类型，需用 list 或 numpy。' },
  { id: 'q15', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['data-types'], question: '以下哪个表达式的结果为 True？', options: ["'hello' == 'hello'", "\"hello\" == 'hello'", '3 > 2 > 1', '以上全部'], correctAnswer: '以上全部', explanation: '单双引号等价；3>2>1 是链式比较。' },
  { id: 'q16', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['data-types'], question: '`type({})` 的返回值是？', options: ["<class 'set'>", "<class 'dict'>", "<class 'list'>", "<class 'tuple'>"], correctAnswer: "<class 'dict'>", explanation: '{} 创建空字典，空集合用 set()。' },
  { id: 'q17', moduleId: 'module-1', type: 'choice', difficulty: 'hard', category: 'extension', tags: ['data-types'], question: '执行 `a = [1, 2, 3]; b = a; b.append(4)` 后，a 的值是？', options: ['[1, 2, 3]', '[1, 2, 3, 4]', '报错', '[1, 2, 3][4]'], correctAnswer: '[1, 2, 3, 4]', explanation: 'b=a 是引用赋值，指向同一列表对象。' },
  { id: 'q18', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['data-types'], question: '元组 tuple 创建完成后，内部元素可以直接修改。', trueFalseAnswer: false, explanation: '元组是不可变类型。' },
  { id: 'q19', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['data-types'], question: '集合（set）中允许存放重复的元素。', trueFalseAnswer: false, explanation: '集合的元素具有唯一性。' },
  { id: 'q20', moduleId: 'module-1', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['data-types', 'errorProne'], question: '字典（dict）的键（key）可以使用列表类型。', trueFalseAnswer: false, explanation: '字典的键必须是不可变类型。' },
  { id: 'q21', moduleId: 'module-1', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['data-types', 'errorProne'], question: '字典中的值（value）不可以为列表类型。', trueFalseAnswer: false, explanation: '字典的值支持任意类型。' },
  { id: 'q22', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['data-types'], question: 'Python 中布尔类型只有 True 和 False 两个取值。', trueFalseAnswer: true, explanation: 'bool 仅含 True 和 False 两种状态。' },
  { id: 'q23', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['data-types', 'errorProne'], question: '空字符串 \'\' 参与逻辑判断时，等价于 False。', trueFalseAnswer: true, explanation: '空字符串、0、空容器在布尔判断中均为假。' },
  { id: 'q24', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['data-types'], question: 'Python 中 None 表示空对象，它不等于数字 0 和空字符串。', trueFalseAnswer: true, explanation: 'None 是独立的空类型。' },
  { id: 'q25', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['data-types', 'errorProne'], question: '字符串属于可变数据类型，可以直接修改其中单个字符。', trueFalseAnswer: false, explanation: '字符串是不可变类型。' },
  { id: 'q26', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['data-types'], question: 'Python 中 1 == True 的运算结果为 True。', trueFalseAnswer: true, explanation: '布尔是整型子类，True 等价于 1。' },
  { id: 'q27', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['data-types', 'errorProne'], question: '空列表 [] 在逻辑判断中会被判定为 True。', trueFalseAnswer: false, explanation: '空容器逻辑判断为 False。' },

  // ----- 运算符 (operators) -----
  { id: 'q28', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['operators'], question: '表达式 `3 ** 2 ** 2` 的结果是？', options: ['81', '64', '729', '18'], correctAnswer: '81', explanation: '** 右结合：3**(2**2)=3**4=81。' },
  { id: 'q29', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['operators'], question: '`print(1 or 2)` 的输出是？', options: ['1', '2', 'True', 'False'], correctAnswer: '1', explanation: 'or 短路返回第一个真值 1。' },
  { id: 'q30', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['operators'], question: 'Python 中 % 运算符的作用是求取两个数字的余数。', trueFalseAnswer: true, explanation: '% 是取模运算符，也可用于字符串格式化。' },
  { id: 'q31', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['operators'], question: '逻辑运算符 and 表示两边条件同时成立，整体结果才为真。', trueFalseAnswer: true, explanation: 'and 是逻辑与，所有条件满足才为 True。' },
  { id: 'q32', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['operators', 'errorProne'], question: '+= 属于 Python 中的复合赋值运算符。', trueFalseAnswer: true, explanation: '+=、-= 等都是复合赋值运算符。' },
  { id: 'q33', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['operators'], question: '逻辑运算符 or 只要一侧条件为真，整体结果就为真。', trueFalseAnswer: true, explanation: 'or 是逻辑或，满足任一即可。' },
  { id: 'q34', moduleId: 'module-1', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['operators', 'errorProne'], question: '运算符优先级：算术运算符高于比较运算符。', trueFalseAnswer: true, explanation: '优先级：算术 > 比较 > 逻辑。' },

  // ----- 流程控制 (control-flow) -----
  { id: 'q35', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['control-flow'], question: 'if...elif...else 语句中，多个分支会同时执行。', trueFalseAnswer: false, explanation: '只执行第一个条件成立的分支。' },
  { id: 'q36', moduleId: 'module-1', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['control-flow', 'errorProne'], question: 'for...else 结构中，循环正常结束没有触发 break 时，会执行 else 代码块。', trueFalseAnswer: true, explanation: 'Python 特有语法：break 中断不执行 else，正常完毕则执行。' },
  { id: 'q37', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['control-flow'], question: 'break 语句可以终止当前所在的循环，跳出循环体。', trueFalseAnswer: true, explanation: 'break 强制结束循环。' },
  { id: 'q38', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['control-flow', 'errorProne'], question: 'continue 语句会直接终止整个循环的执行。', trueFalseAnswer: false, explanation: 'continue 仅跳过当次循环。' },
  { id: 'q39', moduleId: 'module-1', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['control-flow', 'errorProne'], question: 'continue 语句可以跳出多层嵌套循环。', trueFalseAnswer: false, explanation: 'continue 仅作用于当前单层循环。' },
  { id: 'q40', moduleId: 'module-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['control-flow'], question: 'while 循环的条件表达式结果必须是布尔类型。', trueFalseAnswer: false, explanation: '数字、字符串等会自动隐式转为布尔值。' },

  // ═══════════════════ module-2: 函数与模块 ═══════════════════

  // ----- 函数 (functions) -----
  { id: 'q41', moduleId: 'module-2', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['functions'], question: 'Python 函数可以返回多个值。', trueFalseAnswer: true, explanation: 'return a,b,c 实际返回一个 tuple。' },
  { id: 'q42', moduleId: 'module-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['functions', 'errorProne'], question: '函数的默认参数值可以是可变对象（如 list），且行为总是安全的。', trueFalseAnswer: false, explanation: '可变默认参数在多次调用间共享，使用 None 作为默认值是最佳实践。' },
  { id: 'q43', moduleId: 'module-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['functions', 'errorProne'], question: '以下哪个是正确的装饰器语法？', options: ['@decorator', '@decorator()', '@decorator func', '@ decorator'], correctAnswer: '@decorator', explanation: '@decorator 是无参装饰器标准写法。' },
  { id: 'q44', moduleId: 'module-2', type: 'choice', difficulty: 'hard', category: 'extension', tags: ['functions', 'errorProne'], question: '执行以下代码，`y` 的值是？\n\n```python\ndef foo(x, lst=[]):\n    lst.append(x)\n    return lst\n\ny = foo(1)\ny = foo(2)\n```', options: ['[1]', '[2]', '[1, 2]', '报错'], correctAnswer: '[1, 2]', explanation: '默认参数 lst 定义时创建一次，多次调用共享同一列表。' },
  { id: 'q45', moduleId: 'module-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['functions'], question: '函数参数中 `*args` 和 `**kwargs` 的作用是？', options: ['*args 接收关键字，**kwargs 接收位置', '*args 接收位置元组，**kwargs 接收关键字字典', '两者功能相同', '用于类型注解'], correctAnswer: '*args 接收位置元组，**kwargs 接收关键字字典', explanation: '*args 收集位置参数为元组，**kwargs 收集关键字参数为字典。' },
  { id: 'q46', moduleId: 'module-2', type: 'short', difficulty: 'hard', category: 'extension', tags: ['functions', 'errorProne'], question: '请解释 Python 中函数调用时的参数传递机制。它是按值传递还是按引用传递？请结合示例说明。', sampleAnswer: 'Python 采用"按对象引用传递"。不可变对象(int,str)函数内修改不影响外部；可变对象(list,dict)在函数内修改会影响外部。示例：def func(lst):lst.append(1) → 会修改外部列表；def func(x):x=5 → 不会修改外部变量。', explanation: 'Python 既非按值也非按引用，而是按对象引用传递。' },
  { id: 'q47', moduleId: 'module-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['functions'], question: '以下哪个是 Python 中合法的 lambda 函数？', options: ['lambda x, y: x + y', 'lambda (x, y): x + y', 'def lambda(x, y): return x + y', 'lambda x: return x + 1'], correctAnswer: 'lambda x, y: x + y', explanation: 'lambda 语法：lambda 参数: 表达式，不能含 return。' },
  { id: 'q48', moduleId: 'module-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['functions'], question: '函数必须设置返回值，不能省略 return 语句。', trueFalseAnswer: false, explanation: '无 return 时默认返回 None。' },
  { id: 'q49', moduleId: 'module-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['functions'], question: '函数的形参可以设置默认值，有默认值的参数必须放在参数列表末尾。', trueFalseAnswer: true, explanation: '带默认值的形参不能放在无默认值参数前面。' },
  { id: 'q50', moduleId: 'module-2', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['functions', 'errorProne'], question: '调用函数时，传入的实参数量必须匹配无默认值的形参数量。', trueFalseAnswer: true, explanation: '实参不足会触发参数缺失错误。' },
  { id: 'q51', moduleId: 'module-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['functions'], question: '函数可以作为另一个函数的参数进行传递。', trueFalseAnswer: true, explanation: 'Python 中函数是一等对象。' },

  // ----- 作用域 (scope) -----
  { id: 'q52', moduleId: 'module-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['scope', 'errorProne'], question: '在 Python 中，可以在函数内部修改全局变量的值而不使用 global 关键字。', trueFalseAnswer: false, explanation: '函数内赋值会创建局部变量，必须用 global。' },
  { id: 'q53', moduleId: 'module-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['scope', 'functions'], question: '使用 global 关键字可以在函数内部修改全局变量。', trueFalseAnswer: true, explanation: 'global 声明变量为全局变量。' },
  { id: 'q54', moduleId: 'module-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['scope'], question: '全局变量在整个代码文件内都可以被访问。', trueFalseAnswer: true, explanation: '全局变量作用域覆盖当前整个文件。' },

  // ----- 模块 (modules) -----
  { id: 'q55', moduleId: 'module-2', type: 'choice', difficulty: 'easy', category: 'core', tags: ['modules'], question: '以下哪个命令可以将模块 my_module 中的 func 函数导入到当前命名空间？', options: ['import my_module.func', 'from my_module import func', 'using my_module.func', 'include my_module.func'], correctAnswer: 'from my_module import func', explanation: 'from...import... 是导入模块成员的标准语法。' },
  { id: 'q56', moduleId: 'module-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['modules'], question: '`__all__` 变量在 Python 模块中的作用是？', options: ['定义模块版本', '控制 from module import * 导入内容', '定义公共 API', '阻止导入'], correctAnswer: '控制 from module import * 导入内容', explanation: '__all__ 列表定义 * 导入时的名称集合。' },
  { id: 'q57', moduleId: 'module-2', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['modules'], question: '使用 `from math import *` 会导入 math 模块中的所有公开属性。', trueFalseAnswer: true, explanation: '导入所有未以下划线开头的名称。' },
  { id: 'q58', moduleId: 'module-2', type: 'short', difficulty: 'medium', category: 'core', tags: ['modules', 'functions'], question: '请说明 Python 模块的搜索路径顺序，以及如何修改模块搜索路径。', sampleAnswer: '搜索顺序：1.当前目录 2.PYTHONPATH 3.site-packages 4.标准库。可用 sys.path.append() 动态添加。', explanation: 'sys.path[0] 是脚本所在目录。' },
  { id: 'q59', moduleId: 'module-2', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['modules'], question: '导入模块后，可以直接使用 模块名.功能名 的方式调用内部功能。', trueFalseAnswer: true, explanation: '标准调用格式：模块名.成员名。' },
  { id: 'q60', moduleId: 'module-2', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['modules'], question: '导入模块后，模块内部的私有变量可以被外部直接访问。', trueFalseAnswer: false, explanation: '下划线开头的变量约定为私有。' },

  // ═══════════════════ module-3: 面向对象编程 ═══════════════════

  // ----- 类与对象 (OOP + classes) -----
  { id: 'q61', moduleId: 'module-3', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['OOP'], question: 'Python 中所有类的方法的第一个参数都代表当前实例，通常命名为 self。', trueFalseAnswer: true, explanation: 'self 指向实例本身。' },
  { id: 'q62', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['classes', 'errorProne'], question: '以下哪个不是 Python 的魔术方法（dunder method）？', options: ['__init__', '__len__', '__main__', '__str__'], correctAnswer: '__main__', explanation: '__main__ 是模块运行标识，不是类的方法。' },
  { id: 'q63', moduleId: 'module-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['classes', 'errorProne'], question: 'Python 中使用 `@property` 装饰器可以让一个方法像属性一样被访问。', trueFalseAnswer: true, explanation: '@property 将方法转为 Getter 属性。' },
  { id: 'q64', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['classes'], question: '以下哪种方法最适合实现类的『单例模式』？', options: ['__new__ 中返回同一实例', '类变量存储唯一实例', '装饰器包装类', '以上都可以'], correctAnswer: '以上都可以', explanation: '三种方式均可实现单例。' },
  { id: 'q65', moduleId: 'module-3', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['classes'], question: '私有属性（如 `self.__x`）在 Python 中是完全无法从类外部访问的。', trueFalseAnswer: false, explanation: '名字改写为 _ClassName__x，仍可访问。' },
  { id: 'q66', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['classes'], question: '下面代码的输出是？\n\n```python\nclass A:\n    x = 1\nclass B(A): pass\nclass C(A): pass\nA.x = 2\nprint(B.x, C.x)\n```', options: ['1 1', '2 2', '1 2', '2 1'], correctAnswer: '2 2', explanation: '类属性共享，B 和 C 向上查找到 A.x=2。' },
  { id: 'q67', moduleId: 'module-3', type: 'short', difficulty: 'hard', category: 'extension', tags: ['OOP', 'classes', 'errorProne'], question: '请说明 Python 中 `__slots__` 的作用和使用场景，以及它与默认的 `__dict__` 相比有什么优势和限制。', sampleAnswer: '__slots__ 声明实例允许的属性名。优势：减少内存、防止动态添加属性、加速访问。限制：子类需单独定义、不能动态添加属性、多继承受限。', explanation: '适合大量实例场景（数据类、游戏对象）。' },
  { id: 'q68', moduleId: 'module-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['OOP', 'classes'], question: '类是对象的模板，对象是类的实例。', trueFalseAnswer: true, explanation: '类定义属性和行为，基于类创建实例对象。' },
  { id: 'q69', moduleId: 'module-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['OOP', 'classes'], question: '__init__ 方法在手动调用类之后才会执行。', trueFalseAnswer: false, explanation: '创建实例时 __init__ 自动触发。' },
  { id: 'q70', moduleId: 'module-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['OOP', 'classes', 'errorProne'], question: '类属性只能通过实例对象访问，不能通过类名直接访问。', trueFalseAnswer: false, explanation: '类属性可通过类名或实例访问。' },

  // ----- 继承 (inheritance) -----
  { id: 'q71', moduleId: 'module-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['inheritance', 'errorProne'], question: 'Python 支持多继承，一个子类可以有多个父类。', trueFalseAnswer: true, explanation: '支持多继承，需要注意 MRO。' },
  { id: 'q72', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['inheritance', 'polymorphism'], question: '在 Python 中，以下哪种方式最符合『面向对象设计原则』中的『里氏替换原则』？', options: ['子类扩展父类但不改变父类行为', '子类完全复制父类方法', '子类可重写所有父类方法', '子类禁止调用父类方法'], correctAnswer: '子类扩展父类但不改变父类行为', explanation: '里氏替换：子类可替代父类而不改变程序正确性。' },
  { id: 'q73', moduleId: 'module-3', type: 'choice', difficulty: 'hard', category: 'extension', tags: ['OOP', 'polymorphism'], question: '执行以下代码，输出是？\n\n```python\nclass A:\n    def __init__(self, v): self.v = v\n    def __eq__(self, other): return self.v == other.v\n\nclass B(A):\n    def __init__(self, v): self.v = v\n\na = A(1); b = B(1)\nprint(a == b)\n```', options: ['True', 'False', 'TypeError', 'None'], correctAnswer: 'True', explanation: 'a.__eq__(b) 调用 A 的 __eq__，self.v=1, other.v=1 返回 True。' },
  { id: 'q74', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['inheritance'], question: '使用 `class Child(Parent1, Parent2)` 定义类时，Child 类的方法解析顺序（MRO）是？', options: ['Child→Parent1→Parent2→object', 'Child→Parent2→Parent1→object', '由 C3 线性化算法决定', '总是先搜索 Parent1'], correctAnswer: '由 C3 线性化算法决定', explanation: 'Python 用 C3 算法计算 MRO。ClassName.__mro__ 可查看。' },
  { id: 'q75', moduleId: 'module-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['OOP', 'inheritance'], question: '子类无法重写父类已经定义好的方法。', trueFalseAnswer: false, explanation: '子类可重写父类同名方法。' },
  { id: 'q76', moduleId: 'module-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['OOP', 'inheritance', 'errorProne'], question: '子类不能调用父类中已经重写的方法。', trueFalseAnswer: false, explanation: '可通过 super() 调用父类方法。' },

  // ----- 多态 (polymorphism) -----
  { id: 'q77', moduleId: 'module-3', type: 'short', difficulty: 'medium', category: 'core', tags: ['polymorphism', 'OOP'], question: 'Python 的 duck typing（鸭子类型）和传统的静态类型语言的多态有什么本质区别？请举例说明。', sampleAnswer: '静态多态基于继承/接口，需显式声明类型；Python duck typing 只关注对象"能做什么"。示例：有 len() 方法的对象就能用 len()，无需继承接口。', explanation: 'Duck typing 不依赖类型声明，更灵活但缺编译检查。' },
  { id: 'q78', moduleId: 'module-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['OOP', 'polymorphism'], question: '实现多态的前提通常是子类重写父类的方法。', trueFalseAnswer: true, explanation: '重写使不同子类呈现不同执行效果。' },
  { id: 'q79', moduleId: 'module-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['OOP', 'polymorphism', 'errorProne'], question: '不同子类调用同名重写方法，执行效果完全一致。', trueFalseAnswer: false, explanation: '多态就是不同子类同名方法不同效果。' },
  { id: 'q80', moduleId: 'module-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['OOP', 'polymorphism'], question: 'Python 实现多态不需要严格定义父类抽象方法。', trueFalseAnswer: true, explanation: '动态语言特性使 Python 无需抽象类即可多态。' },

  // ═══════════════════ module-4: 进阶与实战 ═══════════════════

  // ----- 异常处理 (exceptions) -----
  { id: 'q81', moduleId: 'module-4', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['exceptions'], question: '在 Python 中，`try...except...finally` 语句中，`finally` 块无论是否发生异常都会执行。', trueFalseAnswer: true, explanation: 'finally 用于清理资源，始终执行。' },
  { id: 'q82', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['exceptions', 'errorProne'], question: '以下哪个语法可以正确捕获所有类型的异常？', options: ['except Exception:', 'except:', 'except BaseException:', '以上都可以'], correctAnswer: '以上都可以', explanation: '最安全的做法是 except Exception:。' },
  { id: 'q83', moduleId: 'module-4', type: 'choice', difficulty: 'hard', category: 'extension', tags: ['exceptions', 'errorProne'], question: '执行以下代码，会输出什么？\n\n```python\ntry:\n    raise ValueError(\'error1\')\nexcept ValueError as e:\n    print(\'caught\')\n    raise TypeError(\'error2\')\nfinally:\n    print(\'finally\')\n```', options: ['caught/finally 各一次', 'caught/finally/finally', 'caught/finally 并抛出 TypeError', '仅 caught'], correctAnswer: 'caught/finally 并抛出 TypeError', explanation: 'except 捕获后打印 caught，raise TypeError，finally 执行，TypeError 向上传播。' },
  { id: 'q84', moduleId: 'module-4', type: 'short', difficulty: 'hard', category: 'extension', tags: ['exceptions', 'errorProne', 'studyHabit'], question: '请说明 Python 中自定义异常类的最佳实践，包括如何命名、是否需要定义额外属性，以及在什么场景下应该创建自定义异常。', sampleAnswer: '命名以 Error 结尾，继承 Exception，在 __init__ 中添加上下文信息（错误码、字段名）。当需要精确表达业务逻辑错误时使用。示例：class PasswordTooShortError(Exception): def __init__(self, length, min_length): ...', explanation: '标准异常不够精确时使用自定义异常，避免过度。' },
  { id: 'q85', moduleId: 'module-4', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['exceptions'], question: 'except 语句可以单独使用，不需要搭配 try 语句。', trueFalseAnswer: false, explanation: 'except 必须依附于 try。' },
  { id: 'q86', moduleId: 'module-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['exceptions', 'errorProne'], question: '可以针对不同类型的异常，设置多个 except 分支分别处理。', trueFalseAnswer: true, explanation: '多 except 分支精准捕获不同异常。' },
  { id: 'q87', moduleId: 'module-4', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['exceptions', 'errorProne'], question: 'try 代码块中出现异常，后续代码依然会继续执行。', trueFalseAnswer: false, explanation: '触发异常后立即跳出 try 块。' },

  // ----- 文件操作 (files) -----
  { id: 'q88', moduleId: 'module-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['files', 'errorProne'], question: '使用 `with open(\'file.txt\') as f:` 打开文件时，文件会在 with 块结束时自动关闭。', trueFalseAnswer: true, explanation: 'with 利用上下文管理器自动关闭文件。' },
  { id: 'q89', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['files'], question: '以二进制模式写入二进制数据，正确的打开方式是？', options: ["open('file', 'w')", "open('file', 'wb')", "open('file', 'bw')", "open('file', 'wb+')"], correctAnswer: "open('file', 'wb')", explanation: "'wb' 是二进制写入模式。'bw' 无效。" },
  { id: 'q90', moduleId: 'module-4', type: 'short', difficulty: 'medium', category: 'core', tags: ['files', 'comprehensions', 'errorProne', 'studyHabit'], question: '请说明 Python 文件操作中『打开模式』的区别（r/w/a/r+/w+/a+/b/t），以及如何安全地处理文件操作中的异常。', sampleAnswer: 'r读/w写(覆盖)/a追加/r+读写/w+读写(覆盖)/a+读写(追加)/b二进制/t文本。安全处理：用 with 自动关闭；try...except 捕获 FileNotFoundError、PermissionError。', explanation: 'with 语句确保正确关闭；针对性捕获异常更安全。' },
  { id: 'q91', moduleId: 'module-4', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['files'], question: '以 r 模式打开文件时，可以向文件中写入新内容。', trueFalseAnswer: false, explanation: 'r 是只读模式。' },
  { id: 'q92', moduleId: 'module-4', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['files', 'errorProne'], question: '以 w 模式打开文件，会清空文件原有内容再写入新数据。', trueFalseAnswer: true, explanation: 'w 先清空，a 在末尾追加。' },
  { id: 'q93', moduleId: 'module-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['files'], question: 'readline() 方法每次只会读取文件中的一行内容。', trueFalseAnswer: true, explanation: 'readline() 逐行读取，read() 一次性读全部。' },
  { id: 'q94', moduleId: 'module-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['files', 'errorProne'], question: '使用 a+ 模式打开文件，既可以读取内容也可以追加写入内容。', trueFalseAnswer: true, explanation: 'a+ 为追加读写模式。' },
  { id: 'q95', moduleId: 'module-4', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['files'], question: 'readlines() 方法会将文件所有行读取为一个列表返回。', trueFalseAnswer: true, explanation: 'readlines() 按行读取返回列表。' },

  // ----- 装饰器 (decorators) -----
  { id: 'q96', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['decorators'], question: '执行以下代码，输出是？\n\n```python\ndef decorator(func):\n    return func\n\n@decorator\ndef foo():\n    return \'hello\'\n\nprint(foo())\n```', options: ['<function func>', "'hello'", '报错', 'None'], correctAnswer: "'hello'", explanation: 'decorator 直接返回 func，foo() 调用原始函数。' },
  { id: 'q97', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['decorators', 'errorProne'], question: '装饰器 `@functools.wraps(func)` 的主要作用是？', options: ['加速执行', '保留元信息（名称、文档字符串等）', '转为协程', '自动处理异常'], correctAnswer: '保留元信息（名称、文档字符串等）', explanation: '@wraps 复制 __name__、__doc__ 等到包装函数。' },
  { id: 'q98', moduleId: 'module-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['decorators', 'errorProne'], question: '带参数的装饰器 `@decorator(arg)` 本质上是一个返回装饰器的函数。', trueFalseAnswer: true, explanation: 'decorator(arg) 返回装饰器函数，再作用于被装饰函数。' },
  { id: 'q99', moduleId: 'module-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['decorators'], question: '使用装饰器会直接修改原函数内部的代码逻辑。', trueFalseAnswer: false, explanation: '装饰器在不改原函数代码前提下拓展功能。' },
  { id: 'q100', moduleId: 'module-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['decorators'], question: '多个装饰器可以同时装饰同一个函数。', trueFalseAnswer: true, explanation: '支持叠加装饰器，由近及远依次生效。' },
  { id: 'q101', moduleId: 'module-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['decorators', 'errorProne'], question: '装饰器无法为函数添加额外的日志记录功能。', trueFalseAnswer: false, explanation: '日志统计是装饰器最常用的场景之一。' },

  // ----- 推导式 (comprehensions) -----
  { id: 'q102', moduleId: 'module-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['comprehensions', 'errorProne'], question: '列表推导式 `[x for x in range(5)]` 与生成器表达式 `(x for x in range(5))` 完全等效。', trueFalseAnswer: false, explanation: '列表推导式返回列表可迭代多次；生成器只可迭代一次。' },
  { id: 'q103', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['comprehensions'], question: '`{x: x**2 for x in range(5)}` 创建的对象类型是？', options: ['dict', 'set', 'list', 'tuple'], correctAnswer: 'dict', explanation: '{key: value for ...} 是字典推导式。' },
  { id: 'q104', moduleId: 'module-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['comprehensions'], question: '字典也可以使用推导式语法快速生成。', trueFalseAnswer: true, explanation: 'Python 支持字典推导式和集合推导式。' },
  { id: 'q105', moduleId: 'module-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['comprehensions', 'errorProne'], question: '集合推导式和列表推导式的语法符号完全相同。', trueFalseAnswer: false, explanation: '列表用 []，集合用 {}。' },
  { id: 'q106', moduleId: 'module-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['comprehensions', 'errorProne'], question: '嵌套循环逻辑也可以使用列表推导式简化编写。', trueFalseAnswer: true, explanation: '列表推导式支持多层循环嵌套。' },
  { id: 'q107', moduleId: 'module-4', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['comprehensions'], question: '推导式语法只能简化循环，不能搭配条件判断。', trueFalseAnswer: false, explanation: '推导式支持结合 if 条件筛选。' },

  // ----- 学习习惯 (studyHabit) -----
  { id: 'q108', moduleId: 'module-4', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['studyHabit', 'syntax'], question: '代码出现报错时，直接忽略报错继续编写即可。', trueFalseAnswer: false, explanation: '需先排查并修复错误再继续。' },
  { id: 'q109', moduleId: 'module-4', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['studyHabit'], question: '编写代码前梳理思路、简单注释，有助于减少出错概率。', trueFalseAnswer: true, explanation: '良好的编码习惯提升代码质量。' },
  { id: 'q110', moduleId: 'module-4', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['studyHabit', 'syntax'], question: '编写代码时统一缩进格式，是良好的 Python 编码习惯。', trueFalseAnswer: true, explanation: '规范缩进规避语法错误，提升可读性。' },
];

// ==================== Tag → Question ID 倒排索引 ====================

function buildTagIndex(): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  for (const q of questions) {
    for (const tag of q.tags) {
      if (!index[tag]) index[tag] = [];
      if (!index[tag].includes(q.id)) index[tag].push(q.id);
    }
  }
  return index;
}

export const tagIndex: Record<string, string[]> = buildTagIndex();

// ==================== 分类统计 ====================

export function getCoreQuestions(): PracticeQuestion[] {
  return questions.filter(q => q.category === 'core');
}

export function getExtensionQuestions(): PracticeQuestion[] {
  return questions.filter(q => q.category === 'extension');
}

export function getCategoryCounts(): { core: number; extension: number } {
  return {
    core: questions.filter(q => q.category === 'core').length,
    extension: questions.filter(q => q.category === 'extension').length,
  };
}

// ==================== 标签搜索框架 ====================

export interface QuestionSearchOptions {
  query?: string;            // 关键词搜索（题目文本）
  tags?: string[];           // 按标签筛选
  difficulty?: PracticeQuestion['difficulty'];
  category?: PracticeQuestion['category'];
  moduleId?: string;
  excludeIds?: string[];     // 排除已完成的题目 ID
  type?: PracticeQuestion['type'];
}

/** 在题库中按条件搜索题目 */
export function searchQuestions(options: QuestionSearchOptions = {}): PracticeQuestion[] {
  let result = [...questions];

  if (options.query) {
    const q = options.query.toLowerCase();
    result = result.filter(item =>
      item.question.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q)) ||
      (item.explanation || '').toLowerCase().includes(q)
    );
  }

  if (options.tags && options.tags.length > 0) {
    result = result.filter(item => item.tags.some(t => options.tags!.includes(t)));
  }

  if (options.difficulty) {
    result = result.filter(item => item.difficulty === options.difficulty);
  }

  if (options.category) {
    result = result.filter(item => item.category === options.category);
  }

  if (options.moduleId) {
    result = result.filter(item => item.moduleId === options.moduleId);
  }

  if (options.type) {
    result = result.filter(item => item.type === options.type);
  }

  if (options.excludeIds && options.excludeIds.length > 0) {
    const excludeSet = new Set(options.excludeIds);
    result = result.filter(item => !excludeSet.has(item.id));
  }

  return result;
}

// ==================== 按学习路径阶段筛选 ====================

/** 根据当前路径阶段的 coreKnowledgePoints 筛选题目 */
export function filterByStage(stage: CurrentPathStage | null): PracticeQuestion[] {
  if (!stage || !stage.coreKnowledgePoints.length) return questions;

  // 先匹配阶段标签，再补全模块相关题目
  const matched = questions.filter(q =>
    q.tags.some(t => stage.coreKnowledgePoints.includes(t))
  );

  // 如果匹配太少，扩大范围
  if (matched.length < 5) {
    const expandedTags = new Set(stage.coreKnowledgePoints);
    for (const tag of stage.coreKnowledgePoints) {
      const related = tagIndex[tag] || [];
      for (const id of related) {
        const q = questions.find(item => item.id === id);
        if (q) q.tags.forEach(t => expandedTags.add(t));
      }
    }
    return questions.filter(q => q.tags.some(t => expandedTags.has(t)));
  }

  return matched;
}

/** 按阶段获取核心题和扩展题的分组 */
export function getStageQuestionSplit(stage: CurrentPathStage | null): {
  core: PracticeQuestion[];
  extension: PracticeQuestion[];
} {
  const stageQuestions = filterByStage(stage);
  return {
    core: stageQuestions.filter(q => q.category === 'core'),
    extension: stageQuestions.filter(q => q.category === 'extension'),
  };
}

// ==================== 按学习进度排序 ====================

/** 薄弱标签题目优先，难度从易到难 */
export function sortByProgress(
  qs: PracticeQuestion[],
  tagScores: TagScore[],
): PracticeQuestion[] {
  const weakTags = new Set(tagScores.filter(ts => ts.score < 60).map(ts => ts.tag));
  const d = { easy: 0, medium: 1, hard: 2 };

  return [...qs].sort((a, b) => {
    const aWeak = a.tags.some(t => weakTags.has(t)) ? 1 : 0;
    const bWeak = b.tags.some(t => weakTags.has(t)) ? 1 : 0;
    if (aWeak !== bWeak) return bWeak - aWeak;
    return (d[a.difficulty] || 0) - (d[b.difficulty] || 0);
  });
}

// ==================== 错题集 ====================

/** 从练习状态中提取错题 */
export function getWrongAnswerQuestions(practiceState: PracticeState | null): PracticeQuestion[] {
  if (!practiceState || !practiceState.results.length) return [];

  const wrongIds = practiceState.results
    .filter(r => (r.isCorrect !== null || r.aiScore !== undefined) && (r.isCorrect === false || (r.aiScore ?? 100) < 60))
    .map(r => r.questionId);

  return questions.filter(q => wrongIds.includes(q.id));
}

/** 错题按学习阶段（模块）分类 */
export function categorizeWrongByModule(
  wrongQuestions: PracticeQuestion[],
): { moduleId: string; moduleName: string; questions: PracticeQuestion[] }[] {
  const groups = new Map<string, PracticeQuestion[]>();

  for (const q of wrongQuestions) {
    const list = groups.get(q.moduleId) || [];
    list.push(q);
    groups.set(q.moduleId, list);
  }

  return learningPlan.modules.map(m => ({
    moduleId: m.id,
    moduleName: m.name,
    questions: groups.get(m.id) || [],
  })).filter(g => g.questions.length > 0);
}

/** 错题按标签分类 */
export function categorizeWrongByTag(
  wrongQuestions: PracticeQuestion[],
): { tag: string; label: string; questions: PracticeQuestion[] }[] {
  const groups = new Map<string, PracticeQuestion[]>();

  for (const q of wrongQuestions) {
    for (const tag of q.tags) {
      const list = groups.get(tag) || [];
      if (!list.includes(q)) list.push(q);
      groups.set(tag, list);
    }
  }

  return Array.from(groups.entries())
    .map(([tag, qs]) => ({ tag, label: tagToChinese(tag), questions: qs }))
    .sort((a, b) => b.questions.length - a.questions.length);
}

// ==================== 进度驱动选题 ====================

export function selectQuestionsByProgress(
  tagScores: TagScore[],
  stageTags: string[],
  count: number,
): string[] {
  const weakTags = tagScores
    .filter(ts => ts.score < 60 && stageTags.includes(ts.tag))
    .sort((a, b) => a.score - b.score);

  const normalTags = stageTags.filter(
    t => !weakTags.some(w => w.tag === t),
  );

  const selected = new Set<string>();
  const result: string[] = [];

  for (const wt of weakTags) {
    const ids = tagIndex[wt.tag] || [];
    const sorted = ids
      .filter(id => !selected.has(id))
      .map(id => questions.find(q => q.id === id)!)
      .filter(Boolean)
      .sort((a, b) => ({ easy: 0, medium: 1, hard: 2 } as Record<string, number>)[a.difficulty] - ({ easy: 0, medium: 1, hard: 2 } as Record<string, number>)[b.difficulty]);
    for (const q of sorted) {
      if (result.length >= count) break;
      selected.add(q.id);
      result.push(q.id);
    }
  }

  for (const tag of normalTags) {
    if (result.length >= count) break;
    const ids = tagIndex[tag] || [];
    for (const id of ids) {
      if (result.length >= count) break;
      if (!selected.has(id)) {
        selected.add(id);
        result.push(id);
      }
    }
  }

  if (result.length < count) {
    for (const q of questions) {
      if (result.length >= count) break;
      if (!selected.has(q.id)) {
        selected.add(q.id);
        result.push(q.id);
      }
    }
  }

  return result.slice(0, count);
}

export function getModuleQuestionIds(moduleId: string): string[] {
  return questions.filter(q => q.moduleId === moduleId).map(q => q.id);
}

export function filterByDifficulty(
  ids: string[],
  difficulty: PracticeQuestion['difficulty'],
): string[] {
  return ids.filter(id => questions.find(q => q.id === id)?.difficulty === difficulty);
}

// ==================== 工具函数 ====================

export function tagToChinese(tag: string): string {
  const map: Record<string, string> = {
    syntax: '语法基础',
    'data-types': '数据类型',
    operators: '运算符',
    'control-flow': '流程控制',
    functions: '函数',
    modules: '模块',
    scope: '作用域',
    OOP: '面向对象',
    classes: '类与对象',
    inheritance: '继承',
    polymorphism: '多态',
    exceptions: '异常处理',
    files: '文件操作',
    decorators: '装饰器',
    comprehensions: '推导式',
    errorProne: '易错点',
    studyHabit: '学习习惯',
  };
  return map[tag] || tag;
}

export function getAllTags(): string[] {
  return Object.keys(tagIndex);
}
