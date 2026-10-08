/**
 * Java 题库 — 统一题目仓库 (160 题)
 *
 * 架构约定：
 * - 所有题目统一归一化标签，标签即知识点的唯一标识
 * - 外部模块按标签搜索 → 按用户完成状态过滤 → 输出题目
 * - category: 'core' 为基础必学内容，'extension' 为扩展挑战
 * - Tag → questionId[] 倒排索引，O(1) 加速 AI 选题
 * - 错题集按学习阶段分组，支持关键词搜索
 */

import type { PracticeQuestion, PracticeState, TagScore } from '../types';
import type { CurrentPathStage } from '../services/learningOrchestrator';

// ==================== 标签规范 ====================
// syntax         — 语法基础（main方法、标识符、关键字、注释、包、导入）
// data-types     — 数据类型（基本类型、引用类型、数组、包装类、字符串池）
// operators      — 运算符（算术、比较、逻辑、赋值、三元、instanceof、位运算）
// control-flow   — 流程控制（if/else、switch、for/while/do-while、break/continue/label）
// functions      — 方法（定义、重载、可变参数、递归、静态导入、协变返回）
// scope          — 作用域（局部变量、成员变量、静态变量、默认值）
// OOP            — 面向对象基础（类/对象、构造方法、this、封装、GC）
// classes        — 类进阶（访问修饰符、static、final、内部类）
// inheritance    — 继承（extends、super、Object、final类/方法、抽象类）
// polymorphism   — 多态（重写、向上/向下转型、动态绑定、instanceof）
// interfaces     — 接口与抽象类（interface、implements、default方法、函数式接口）
// exceptions     — 异常处理（try/catch/finally、throw/throws、自定义异常、Error）
// collections    — 集合框架（List/Set/Map/Queue、ArrayList/HashMap、Comparable、Iterator）
// generics       — 泛型（类型参数、通配符、类型擦除、菱形运算符）
// io             — I/O流（字节流/字符流、BufferedReader、NIO、Path、序列化）
// multithreading — 多线程（Thread/Runnable、sleep/join、volatile、synchronized、start）
// lambda         — Lambda与Stream（Lambda表达式、方法引用、函数式接口、Stream操作）
// annotations    — 注解（@Override、@Deprecated、@Retention、@Target）
// errorProne     — 易错点（空指针、数组越界、类型转换、装箱拆箱）
// studyHabit     — 学习习惯（命名规范、编码风格、调试技巧）

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
  id: 'java-basics',
  name: 'Java 编程基础',
  description: '系统学习 Java 编程，从语法基础到多线程与函数式编程',
  modules: [
    {
      id: 'module-1',
      name: 'Java 基础语法',
      description: '数据类型、运算符、流程控制',
      tags: ['syntax', 'data-types', 'operators', 'control-flow'],
    },
    {
      id: 'module-2',
      name: '方法与作用域',
      description: '方法定义、重载、参数传递、变量作用域',
      tags: ['functions', 'scope', 'errorProne'],
    },
    {
      id: 'module-3',
      name: '面向对象编程',
      description: '类与对象、继承与多态、接口与抽象类',
      tags: ['OOP', 'classes', 'inheritance', 'polymorphism', 'interfaces', 'errorProne'],
    },
    {
      id: 'module-4',
      name: '进阶与实战',
      description: '异常处理、集合框架、I/O流、多线程、Lambda与注解',
      tags: ['exceptions', 'collections', 'generics', 'io', 'multithreading', 'lambda', 'annotations', 'errorProne', 'studyHabit'],
    },
  ],
};

// ==================== 全部题目 ====================

export const questions: PracticeQuestion[] = [

  // ═══════════════════ Java 基础语法 ═══════════════════

  // ----- 语法基础 (syntax) -----
  { id: 'j1', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['syntax'], question: "包（package）的作用是什么？", options: ["组织类和接口，避免命名冲突", "提高程序运行速度", "实现多线程", "进行异常处理"], correctAnswer: "组织类和接口，避免命名冲突", explanation: "包用于分类管理类，类似文件目录。" },
  { id: 'j2', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['syntax'], question: "导入一个包中所有类的正确语法是？", options: ["import java.util.*;", "import java.util.all;", "import java.util;", "include java.util.*;"], correctAnswer: "import java.util.*;", explanation: "使用 * 导入包中所有类，但不会导入子包。" },
  { id: 'j30', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['syntax'], question: "Java 中多行注释以 /* 开始，以什么结束？", options: ["*/", "//", "*/", "**/"], correctAnswer: "*/", explanation: "多行注释是 /* */，不能嵌套。" },
  { id: 'j45', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['syntax'], question: "以下哪个是合法的 Java 标识符？", options: ["2name", "_name", "name#", "class"], correctAnswer: "_name", explanation: "标识符可以字母、下划线、美元符开头，不能数字开头，不能是关键字。" },
  { id: 'j51', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['syntax'], question: "Java 程序编译后生成的文件扩展名是 ___。", sampleAnswer: ".class", explanation: "javac 编译 .java 源文件得到字节码文件 .class，由 JVM 执行。" },
  { id: 'j52', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['syntax'], question: "main 方法参数列表中的数组类型是 ___[]。", sampleAnswer: "String", explanation: "main 方法的参数是 String[] args，用于接收命令行参数。" },
  { id: 'j79', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['syntax'], question: "Java Development Kit 的缩写是 ___。", sampleAnswer: "JDK", explanation: "JDK 包含 JRE 和开发工具。" },
  { id: 'j94', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['syntax'], question: "Java Runtime Environment 的缩写是 ___。", sampleAnswer: "JRE", explanation: "JRE 提供运行 Java 程序所需的环境。" },
  { id: 'j101', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['syntax'], question: "Java 程序的执行入口方法是？", options: ["start()", "main()", "run()", "init()"], correctAnswer: "main()", explanation: "public static void main(String[] args) 是 Java 固定入口方法。" },
  { id: 'j102', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['syntax'], question: "Java 单行注释使用哪个符号？", options: ["#", "//", "/*", "--"], correctAnswer: "//", explanation: "// 用于单行注释，/* */ 用于多行注释。" },
  { id: 'j103', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['syntax', 'errorProne'], question: "Java 用来划分代码块的符号是？", options: ["()", "[]", "{}", "<>"], correctAnswer: "{}", explanation: "大括号 {} 是 Java 划分代码块的标准符号。" },
  { id: 'j130', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['syntax', 'errorProne'], question: "Java 语句结束标志是？", options: [".", ";", ",", ":"], correctAnswer: ";", explanation: "分号 ; 是 Java 单行语句结束符。" },
  { id: 'j143', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['syntax'], question: "多行注释的格式是？", options: ["// 内容", "/* 内容 */", "# 内容", "-- 内容"], correctAnswer: "/* 内容 */", explanation: "/* */ 包裹多行注释内容。" },
  { id: 'j151', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['syntax'], question: "Java 程序入口方法是________。", sampleAnswer: "main", explanation: "main 方法是 Java 应用程序唯一执行入口。" },
  { id: 'j152', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['syntax'], question: "Java 单行注释符号为________。", sampleAnswer: "//", explanation: "// 用于单行代码注释。" },
  { id: 'j153', moduleId: 'module-1', type: 'short', difficulty: 'medium', category: 'core', tags: ['syntax', 'errorProne'], question: "Java 使用________符号划分代码块。", sampleAnswer: "{}", explanation: "大括号是 Java 代码块的标志。" },

  // ----- 数据类型 (data-types) -----
  { id: 'j3', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['data-types'], question: "以下哪个是正确的数组声明？", options: ["int[] a = new int[5];", "int a[5];", "int a = new int[5];", "int a[] = new int[];"], correctAnswer: "int[] a = new int[5];", explanation: "标准语法：类型[] 变量名 = new 类型[长度];" },
  { id: 'j4', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['data-types'], question: "将 int 转换为 Integer 的过程称为？", options: ["拆箱", "装箱", "转换", "强制类型转换"], correctAnswer: "装箱", explanation: "基本类型到包装类的转换称为自动装箱（autoboxing）。" },
  { id: 'j31', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['data-types'], question: "以下哪个字面量表示 float 类型？", options: ["3.14", "3.14f", "3.14d", "3.14L"], correctAnswer: "3.14f", explanation: "默认浮点数是 double，加 f 或 F 表示 float。" },
  { id: 'j46', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['data-types'], question: "将 double 赋值给 int 会发生什么？", options: ["自动转换", "编译错误，需要强制转换", "运行时异常", "截断小数部分"], correctAnswer: "编译错误，需要强制转换", explanation: "double 到 int 是窄化转换，必须显式强制类型转换，可能丢失精度。" },
  { id: 'j53', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['data-types'], question: "Java 中布尔类型的字面量只有 true 和 ___。", sampleAnswer: "false", explanation: "boolean 类型只有两个值。" },
  { id: 'j54', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['data-types'], question: "char 类型在 Java 中占用 ___ 个字节。", sampleAnswer: "2", explanation: "char 是 16 位无符号整数，采用 Unicode 编码。" },
  { id: 'j80', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['data-types'], question: "Java 为了节省内存，字符串字面量存储在 ___ 池中。", sampleAnswer: "字符串常量", explanation: "相同内容的字符串字面量引用同一个对象。" },
  { id: 'j95', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['data-types'], question: "引用类型变量可以赋值为 ___，表示不指向任何对象。", sampleAnswer: "null", explanation: "访问 null 引用的成员会抛出 NullPointerException。" },
  { id: 'j104', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['data-types'], question: "以下不属于 Java 基本数据类型的是？", options: ["int", "String", "char", "boolean"], correctAnswer: "String", explanation: "String 是引用类型，其余三项为基本数据类型。" },
  { id: 'j105', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['data-types', 'errorProne'], question: "布尔类型的取值个数是？", options: ["1", "2", "3", "4"], correctAnswer: "2", explanation: "boolean 只有 true、false 两个取值。" },
  { id: 'j106', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['data-types'], question: "Java 数组下标起始位置是？", options: ["0", "1", "-1", "随机"], correctAnswer: "0", explanation: "数组下标从 0 开始，最大下标为 数组长度-1。" },
  { id: 'j107', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['data-types', 'errorProne'], question: "获取数组长度使用以下哪项？", options: ["size()", "length", "getLength()", "len()"], correctAnswer: "length", explanation: "数组用 length 属性，集合用 size() 方法。" },
  { id: 'j131', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['data-types'], question: "以下哪项是字符类型？", options: ["int", "double", "char", "long"], correctAnswer: "char", explanation: "char 为字符类型，用于存储单个字符。" },
  { id: 'j132', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['data-types'], question: "数组访问下标越界会抛出？", options: ["空指针异常", "数组下标越界异常", "类型转换异常", "编译异常"], correctAnswer: "数组下标越界异常", explanation: "数组访问超出下标范围，抛出 ArrayIndexOutOfBoundsException。" },
  { id: 'j144', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['data-types', 'errorProne'], question: "以下浮点类型是？", options: ["int", "float", "byte", "short"], correctAnswer: "float", explanation: "float、double 为浮点型，存储小数。" },
  { id: 'j145', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['data-types'], question: "数组创建后，长度是否可以改变？", options: ["可以", "不可以", "部分可以", "动态改变"], correctAnswer: "不可以", explanation: "Java 数组长度固定，创建后无法修改。" },
  { id: 'j154', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['data-types'], question: "布尔类型的两个取值是 true 和________。", sampleAnswer: "false", explanation: "boolean 类型只有两个布尔值。" },
  { id: 'j155', moduleId: 'module-1', type: 'short', difficulty: 'medium', category: 'core', tags: ['data-types', 'errorProne'], question: "String 属于________数据类型。", sampleAnswer: "引用", explanation: "String 不是基本类型，属于引用类型。" },
  { id: 'j156', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['data-types'], question: "Java 数组下标从________开始。", sampleAnswer: "0", explanation: "数组下标默认从 0 计数。" },
  { id: 'j157', moduleId: 'module-1', type: 'short', difficulty: 'medium', category: 'core', tags: ['data-types', 'errorProne'], question: "获取数组长度使用________属性。", sampleAnswer: "length", explanation: "数组.length 得到数组长度。" },

  // ----- 运算符 (operators) -----
  { id: 'j5', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['operators'], question: "表达式 int a = 5; int b = a++; 执行后 a 和 b 的值分别是？", options: ["a=5, b=5", "a=6, b=5", "a=5, b=6", "a=6, b=6"], correctAnswer: "a=6, b=5", explanation: "a++ 先返回原值再自增，所以 b=5, a=6。" },
  { id: 'j6', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['operators'], question: "三元运算符 ?: 的语法是 condition ? expr1 : expr2，expr1 和 expr2 的类型必须？", options: ["完全相同", "可以不同，会自动转换", "必须是基本类型", "必须是引用类型"], correctAnswer: "可以不同，会自动转换", explanation: "Java 会尝试进行类型提升，如果不能兼容则编译错误。" },
  { id: 'j32', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['operators'], question: "以下哪个是复合赋值运算符？", options: ["+=", "++", "&&", "=="], correctAnswer: "+=", explanation: "+=、-=、*=、/= 等都是复合赋值。" },
  { id: 'j55', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['operators'], question: "Java 中求余运算符是 ___。", sampleAnswer: "%", explanation: "例如 10 % 3 = 1。" },
  { id: 'j56', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['operators'], question: "有符号右移运算符是 ___。", sampleAnswer: ">>", explanation: ">> 用符号位填充高位，>>> 无符号右移补零。" },
  { id: 'j81', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['operators'], question: "逻辑或的短路运算符是 ___。", sampleAnswer: "||", explanation: "如果左侧为 true，右侧不再计算。" },
  { id: 'j96', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['operators'], question: "instanceof 运算符用于测试对象是否为某个 ___ 的实例。", sampleAnswer: "类", explanation: "或接口、数组类型。" },
  { id: 'j108', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['operators'], question: "判断两个基本类型数值是否相等使用？", options: ["=", "==", "equals", "==="], correctAnswer: "==", explanation: "== 比较基本类型数值，= 是赋值运算符。" },
  { id: 'j109', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['operators', 'errorProne'], question: "具备短路效果的逻辑与运算符是？", options: ["&", "&&", "|", "||"], correctAnswer: "&&", explanation: "&& 短路与，|| 短路或，& 和 | 无短路特性。" },
  { id: 'j133', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['operators'], question: "赋值运算符是？", options: ["==", "=", "!=", ">="], correctAnswer: "=", explanation: "= 用于赋值，== 用于判断相等。" },
  { id: 'j146', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['operators', 'errorProne'], question: "三元运算符的表达式个数是？", options: ["1个", "2个", "3个", "4个"], correctAnswer: "3个", explanation: "三元运算符：条件 ? 表达式1 : 表达式2，共三部分。" },
  { id: 'j158', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['operators'], question: "判断基本类型数值相等使用________运算符。", sampleAnswer: "==", explanation: "== 比较数值，= 为赋值运算符。" },
  { id: 'j159', moduleId: 'module-1', type: 'short', difficulty: 'medium', category: 'core', tags: ['operators', 'errorProne'], question: "具备短路效果的逻辑与运算符是________。", sampleAnswer: "&&", explanation: "&& 左边为 false 则右边不执行。" },

  // ----- 流程控制 (control-flow) -----
  { id: 'j7', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['control-flow'], question: "增强 for 循环（for-each）的语法是？", options: ["for (int i=0; i<arr.length; i++)", "for (var item : arr)", "foreach (item in arr)", "for each item in arr"], correctAnswer: "for (var item : arr)", explanation: "增强 for 循环：for (类型 变量名 : 数组或集合)" },
  { id: 'j8', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['control-flow'], question: "continue 语句的作用是？", options: ["退出当前循环", "跳过本次循环剩余代码，继续下一次迭代", "跳到循环开始处", "终止程序"], correctAnswer: "跳过本次循环剩余代码，继续下一次迭代", explanation: "continue 忽略本次循环后续语句，进入下一次循环。" },
  { id: 'j33', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['control-flow'], question: "if (condition) { } else { } 中，if 后面的条件必须是？", options: ["boolean 类型", "int 类型", "Object 类型", "任意类型"], correctAnswer: "boolean 类型", explanation: "条件必须是布尔表达式，不同于 C/C++ 非零为真。" },
  { id: 'j47', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['control-flow'], question: "Java 中带标签的 break 用于？", options: ["跳出多层循环", "跳出 switch", "终止方法", "跳过本次迭代"], correctAnswer: "跳出多层循环", explanation: "break outer; 可以跳出外层循环。" },
  { id: 'j57', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['control-flow'], question: "switch 语句中的表达式类型可以是 byte, short, int, char, String 以及 ___ 类型（自 Java 5）。", sampleAnswer: "enum", explanation: "枚举类型也可以作为 switch 的表达式。" },
  { id: 'j58', moduleId: 'module-1', type: 'short', difficulty: 'medium', category: 'core', tags: ['control-flow'], question: "___ 循环至少执行一次循环体。", sampleAnswer: "do-while", explanation: "do-while 先执行一次循环体，再判断条件。" },
  { id: 'j82', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['control-flow'], question: "增强 for 循环的语法是 for (type var : ___)。", sampleAnswer: "array_or_iterable", explanation: "冒号右边必须是数组或实现了 Iterable 的对象。" },
  { id: 'j97', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['control-flow'], question: "使用带 ___ 的 break 可以跳出多重循环。", sampleAnswer: "标签", explanation: "例如 outer: for(...) { break outer; }" },
  { id: 'j110', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['control-flow'], question: "跳出当前循环的语句是？", options: ["continue", "break", "return", "goto"], correctAnswer: "break", explanation: "break 终止循环，continue 跳过本轮循环。" },
  { id: 'j111', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['control-flow', 'errorProne'], question: "以下哪项不是循环语句？", options: ["for", "while", "do...while", "switch"], correctAnswer: "switch", explanation: "switch 是分支语句，不属于循环结构。" },
  { id: 'j134', moduleId: 'module-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['control-flow'], question: "do...while 循环的特点是？", options: ["先判断后执行", "先执行后判断", "永不执行", "执行两次"], correctAnswer: "先执行后判断", explanation: "do...while 至少执行一次循环体。" },
  { id: 'j147', moduleId: 'module-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['control-flow'], question: "多选一分支语句是？", options: ["if", "switch", "for", "while"], correctAnswer: "switch", explanation: "switch 适用于多分支等值判断场景。" },
  { id: 'j160', moduleId: 'module-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['control-flow'], question: "终止当前循环使用________语句。", sampleAnswer: "break", explanation: "break 强制退出当前循环体。" },


  // ═══════════════════ 方法与作用域 ═══════════════════

  // ----- 方法 (functions) -----
  { id: 'j9', moduleId: 'module-2', type: 'choice', difficulty: 'easy', category: 'core', tags: ['functions'], question: "如果一个方法声明返回类型为 void，可以省略 return 语句吗？", options: ["必须有一个 return", "可以没有 return", "必须返回 null", "编译器自动添加 return"], correctAnswer: "可以没有 return", explanation: "void 方法不需要 return，但可以使用 return; 提前退出。" },
  { id: 'j10', moduleId: 'module-2', type: 'choice', difficulty: 'hard', category: 'extension', tags: ['functions'], question: "可变参数（varargs）的语法是？", options: ["void method(int... args)", "void method(int[] args)", "void method(int args...)", "void method(args... int)"], correctAnswer: "void method(int... args)", explanation: "类型后跟三个点，表示可变长度参数，必须放在参数列表最后。" },
  { id: 'j34', moduleId: 'module-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['functions'], question: "递归函数必须包含？", options: ["循环", "终止条件", "静态变量", "返回值"], correctAnswer: "终止条件", explanation: "没有终止条件的递归会导致栈溢出。" },
  { id: 'j48', moduleId: 'module-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['functions'], question: "方法重写时，子类方法的返回类型可以是父类方法返回类型的子类吗？", options: ["必须完全相同", "可以是子类（协变返回类型）", "必须是父类", "不能改变"], correctAnswer: "可以是子类（协变返回类型）", explanation: "Java 支持协变返回类型，即子类重写时返回更具体的类型。" },
  { id: 'j59', moduleId: 'module-2', type: 'short', difficulty: 'easy', category: 'core', tags: ['functions'], question: "方法签名由方法名和 ___ 列表组成。", sampleAnswer: "参数", explanation: "返回类型不属于方法签名，仅用于重载区分。" },
  { id: 'j60', moduleId: 'module-2', type: 'short', difficulty: 'medium', category: 'core', tags: ['functions'], question: "使用 ___ import 可以导入类的静态成员，直接使用而不需要类名前缀。", sampleAnswer: "static", explanation: "例如 import static java.lang.Math.PI; 然后直接使用 PI。" },
  { id: 'j83', moduleId: 'module-2', type: 'short', difficulty: 'easy', category: 'core', tags: ['functions'], question: "使用 ___ 语句从方法中返回值。", sampleAnswer: "return", explanation: "return 表达式；void 方法可以用 return; 提前退出。" },
  { id: 'j98', moduleId: 'module-2', type: 'short', difficulty: 'medium', category: 'core', tags: ['functions'], question: "方法重载的解析发生在 ___ 时（编译期或运行期）。", sampleAnswer: "编译期", explanation: "重载是静态绑定，重写是动态绑定。" },
  { id: 'j112', moduleId: 'module-2', type: 'choice', difficulty: 'easy', category: 'core', tags: ['functions'], question: "表示方法无返回值的关键字是？", options: ["null", "void", "empty", "none"], correctAnswer: "void", explanation: "void 修饰无返回值方法。" },
  { id: 'j113', moduleId: 'module-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['functions', 'errorProne'], question: "方法重载的要求不包括？", options: ["方法名相同", "参数列表不同", "返回值不同", "参数类型不同"], correctAnswer: "返回值不同", explanation: "重载与返回值无关，只看方法名和参数列表。" },
  { id: 'j135', moduleId: 'module-2', type: 'choice', difficulty: 'easy', category: 'core', tags: ['functions'], question: "方法返回数据使用的关键字是？", options: ["return", "back", "result", "send"], correctAnswer: "return", explanation: "return 实现方法数据返回。" },
  { id: 'j148', moduleId: 'module-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['functions', 'errorProne'], question: "构造方法是否存在返回值？", options: ["有 int 返回值", "有 void 返回值", "无返回值", "有 String 返回值"], correctAnswer: "无返回值", explanation: "构造方法没有任何返回值类型。" },

  // ----- 作用域 (scope) -----
  { id: 'j114', moduleId: 'module-2', type: 'choice', difficulty: 'easy', category: 'core', tags: ['scope'], question: "定义在方法内部的变量称为？", options: ["成员变量", "局部变量", "静态变量", "全局变量"], correctAnswer: "局部变量", explanation: "方法内为局部变量，类中方法外为成员变量。" },
  { id: 'j115', moduleId: 'module-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['scope', 'errorProne'], question: "局部变量默认初始值为？", options: ["0", "null", "空", "无默认值"], correctAnswer: "无默认值", explanation: "局部变量必须手动赋值，没有默认初始值。" },


  // ═══════════════════ 面向对象编程 ═══════════════════

  // ----- 面向对象基础 (OOP) -----
  { id: 'j11', moduleId: 'module-3', type: 'choice', difficulty: 'easy', category: 'core', tags: ['OOP', 'classes'], question: "创建一个对象使用的关键字是？", options: ["class", "new", "create", "object"], correctAnswer: "new", explanation: "new 关键字用于实例化对象，分配内存并调用构造器。" },
  { id: 'j12', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['OOP', 'classes'], question: "以下哪个访问修饰符的可见性范围最大？", options: ["private", "default (无修饰符)", "protected", "public"], correctAnswer: "public", explanation: "public 对所有类可见，private 仅对当前类可见。" },
  { id: 'j35', moduleId: 'module-3', type: 'choice', difficulty: 'easy', category: 'core', tags: ['OOP', 'classes'], question: "静态变量存储在内存的哪个区域？", options: ["栈", "堆", "方法区（或元空间）", "寄存器"], correctAnswer: "方法区（或元空间）", explanation: "静态变量属于类，存储在方法区（JDK 8 后元空间）。" },
  { id: 'j49', moduleId: 'module-3', type: 'choice', difficulty: 'easy', category: 'core', tags: ['OOP', 'classes'], question: "关键字 this 在构造器中可以用来调用另一个重载构造器，语法是？", options: ["this()", "super()", "this(param)", "super(param)"], correctAnswer: "this(param)", explanation: "this() 调用本类其他构造器，且必须是第一行语句。注意：this(param) 才是带参数调用重载构造器的语法。" },
  { id: 'j61', moduleId: 'module-3', type: 'short', difficulty: 'easy', category: 'core', tags: ['OOP', 'classes'], question: "构造器的名称必须与 ___ 名完全相同。", sampleAnswer: "类", explanation: "构造器没有返回类型，名字与类名一致。" },
  { id: 'j62', moduleId: 'module-3', type: 'short', difficulty: 'easy', category: 'core', tags: ['OOP', 'classes'], question: "Java 自动内存管理机制称为 ___ 收集。", sampleAnswer: "垃圾", explanation: "垃圾回收器（Garbage Collection）自动回收不再使用的对象。" },
  { id: 'j84', moduleId: 'module-3', type: 'short', difficulty: 'easy', category: 'core', tags: ['OOP', 'classes'], question: "将实例变量声明为 private，然后提供公共的 getter/setter，体现了面向对象的 ___ 特性。", sampleAnswer: "封装", explanation: "隐藏内部状态，控制访问。" },
  { id: 'j99', moduleId: 'module-3', type: 'short', difficulty: 'easy', category: 'core', tags: ['OOP', 'operators'], question: "使用 ___ 可以判断对象是否属于某个类。", sampleAnswer: "instanceof", explanation: "if (obj instanceof String) { ... }" },
  { id: 'j116', moduleId: 'module-3', type: 'choice', difficulty: 'easy', category: 'core', tags: ['OOP', 'classes'], question: "定义类使用的关键字是？", options: ["class", "struct", "object", "define"], correctAnswer: "class", explanation: "class 是 Java 定义类的关键字。" },
  { id: 'j117', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['OOP', 'classes', 'errorProne'], question: "创建对象使用哪个关键字？", options: ["create", "new", "instance", "build"], correctAnswer: "new", explanation: "new 关键字调用构造方法创建实例对象。" },
  { id: 'j118', moduleId: 'module-3', type: 'choice', difficulty: 'easy', category: 'core', tags: ['OOP', 'inheritance'], question: "实现类继承的关键字是？", options: ["implements", "extends", "inherits", "using"], correctAnswer: "extends", explanation: "extends 实现类继承，implements 实现接口。" },
  { id: 'j119', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['OOP', 'inheritance', 'errorProne'], question: "Java 类的继承形式是？", options: ["多继承", "单继承", "无继承", "随机继承"], correctAnswer: "单继承", explanation: "Java 类只支持单继承，接口支持多实现。" },
  { id: 'j120', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['OOP', 'polymorphism'], question: "多态的运行特点是？", options: ["编译看子类", "运行看子类", "运行看父类", "编译运行都看父类"], correctAnswer: "运行看子类", explanation: "多态：编译绑定父类，运行执行子类重写方法。" },
  { id: 'j136', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['OOP', 'classes', 'errorProne'], question: "构造方法的名称要求是？", options: ["固定为 init", "与类名相同", "任意名称", "必须带返回值"], correctAnswer: "与类名相同", explanation: "构造方法名必须和类名完全一致。" },
  { id: 'j137', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['OOP', 'inheritance'], question: "子类重写父类方法的目的是？", options: ["删除父类方法", "改写原有逻辑", "修改方法名", "修改权限为 private"], correctAnswer: "改写原有逻辑", explanation: "重写用于在子类中重新实现方法逻辑。" },
  { id: 'j138', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['OOP', 'polymorphism', 'errorProne'], question: "子类对象赋值给父类引用的过程称为？", options: ["向下转型", "向上转型", "强制转换", "自动转换"], correctAnswer: "向上转型", explanation: "向上转型是多态的基础。" },
  { id: 'j149', moduleId: 'module-3', type: 'choice', difficulty: 'easy', category: 'core', tags: ['OOP', 'classes'], question: "对象的成员变量也可称为？", options: ["局部变量", "属性", "常量", "静态变量"], correctAnswer: "属性", explanation: "类中定义的成员变量描述对象属性。" },
  { id: 'j150', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['OOP', 'inheritance', 'errorProne'], question: "子类不能继承父类哪类成员？", options: ["public 成员", "private 成员", "protected 成员", "默认权限成员"], correctAnswer: "private 成员", explanation: "private 私有成员仅父类内部可见，子类无法继承访问。" },

  // ----- 类进阶 (classes) -----
  { id: 'j127', moduleId: 'module-3', type: 'choice', difficulty: 'easy', category: 'core', tags: ['classes'], question: "权限最小、仅本类可访问的修饰符是？", options: ["public", "private", "protected", "default"], correctAnswer: "private", explanation: "private 私有权限，作用范围最小。" },
  { id: 'j128', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['classes', 'errorProne'], question: "被 static 修饰的成员属于？", options: ["对象", "类", "方法", "包"], correctAnswer: "类", explanation: "静态成员属于类，全局共享。" },
  { id: 'j129', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['classes'], question: "被 final 修饰的变量称为？", options: ["静态变量", "常量", "局部变量", "成员变量"], correctAnswer: "常量", explanation: "final 变量赋值后不可修改，即为常量。" },
  { id: 'j142', moduleId: 'module-3', type: 'choice', difficulty: 'easy', category: 'core', tags: ['classes'], question: "访问权限最大的修饰符是？", options: ["public", "private", "protected", "default"], correctAnswer: "public", explanation: "public 公开访问，任何位置都可调用。" },

  // ----- 继承 (inheritance) -----
  { id: 'j13', moduleId: 'module-3', type: 'choice', difficulty: 'easy', category: 'core', tags: ['inheritance'], question: "final 关键字修饰的类有什么特点？", options: ["可以被继承", "不能被继承", "必须被继承", "不能被实例化"], correctAnswer: "不能被继承", explanation: "final 类不能有子类，如 String 类。" },
  { id: 'j14', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['inheritance'], question: "关于抽象类，以下说法正确的是？", options: ["抽象类不能有构造方法", "抽象类可以包含非抽象方法", "抽象类不能有成员变量", "抽象类必须被 final 修饰"], correctAnswer: "抽象类可以包含非抽象方法", explanation: "抽象类可以有构造器、字段和具体方法，但不能实例化。" },
  { id: 'j36', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['inheritance'], question: "所有 Java 类的最终父类是？", options: ["Object", "Class", "System", "Main"], correctAnswer: "Object", explanation: "Object 是根类，提供 toString, equals, hashCode 等方法。" },
  { id: 'j63', moduleId: 'module-3', type: 'short', difficulty: 'easy', category: 'core', tags: ['inheritance'], question: "类继承使用 ___ 关键字。", sampleAnswer: "extends", explanation: "子类 extends 父类。" },
  { id: 'j64', moduleId: 'module-3', type: 'short', difficulty: 'easy', category: 'core', tags: ['inheritance'], question: "包含抽象方法的类必须声明为 ___ 类。", sampleAnswer: "abstract", explanation: "抽象类可以包含具体方法，但至少有一个抽象方法时必须是 abstract。" },
  { id: 'j85', moduleId: 'module-3', type: 'short', difficulty: 'medium', category: 'core', tags: ['inheritance'], question: "用 ___ 修饰的方法不能被子类重写。", sampleAnswer: "final", explanation: "final 方法保证行为不变。" },

  // ----- 多态 (polymorphism) -----
  { id: 'j15', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['polymorphism'], question: "向下转型（downcasting）需要？", options: ["自动进行", "显式类型转换，可能抛出 ClassCastException", "不需要转换", "只能用于接口"], correctAnswer: "显式类型转换，可能抛出 ClassCastException", explanation: "向下转型需要强制转换，并使用 instanceof 检查以避免异常。" },
  { id: 'j37', moduleId: 'module-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['polymorphism', 'operators'], question: "instanceof 运算符返回什么类型？", options: ["int", "boolean", "Object", "Class"], correctAnswer: "boolean", explanation: "instanceof 返回 true 或 false。" },
  { id: 'j65', moduleId: 'module-3', type: 'short', difficulty: 'medium', category: 'core', tags: ['polymorphism'], question: "Java 中对于重写的方法，调用时采用 ___ 绑定（根据实际对象类型）。", sampleAnswer: "动态", explanation: "运行时动态绑定决定调用哪个版本。" },
  { id: 'j86', moduleId: 'module-3', type: 'short', difficulty: 'medium', category: 'core', tags: ['polymorphism'], question: "将父类引用强制转换为子类类型称为向 ___ 转型。", sampleAnswer: "下", explanation: "向下转型（downcasting）需要使用 instanceof 检查。" },

  // ----- 接口与抽象类 (interfaces) -----
  { id: 'j16', moduleId: 'module-3', type: 'choice', difficulty: 'easy', category: 'core', tags: ['interfaces'], question: "Java 8 中接口允许定义默认方法（default method），其目的是？", options: ["强制子类实现", "提供方法的默认实现，不影响已有实现", "创建静态方法", "实现多重继承"], correctAnswer: "提供方法的默认实现，不影响已有实现", explanation: "默认方法允许接口演进而不破坏现有代码。" },
  { id: 'j66', moduleId: 'module-3', type: 'short', difficulty: 'easy', category: 'core', tags: ['interfaces'], question: "类实现接口使用 ___ 关键字。", sampleAnswer: "implements", explanation: "一个类可以实现多个接口。" },


  // ═══════════════════ 进阶与实战 ═══════════════════

  // ----- 异常处理 (exceptions) -----
  { id: 'j17', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['exceptions'], question: "throws 关键字用于？", options: ["实际抛出异常", "声明方法可能抛出的异常", "捕获异常", "创建自定义异常"], correctAnswer: "声明方法可能抛出的异常", explanation: "throws 出现在方法签名中，表示该方法不处理异常，交给调用者。" },
  { id: 'j18', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['exceptions'], question: "创建自定义 checked 异常应该继承哪个类？", options: ["Exception", "RuntimeException", "Throwable", "Error"], correctAnswer: "Exception", explanation: "继承 Exception 得到 checked 异常；继承 RuntimeException 得到 unchecked 异常。" },
  { id: 'j38', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['exceptions'], question: "以下哪个是运行时异常（unchecked exception）？", options: ["IOException", "SQLException", "NullPointerException", "ClassNotFoundException"], correctAnswer: "NullPointerException", explanation: "NullPointerException 是 RuntimeException 的子类，不需要强制处理。" },
  { id: 'j50', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['exceptions'], question: "多个 catch 块捕获异常时，顺序应该是？", options: ["任意顺序", "先子类后父类", "先父类后子类", "只能捕获一个异常"], correctAnswer: "先子类后父类", explanation: "更具体的子类异常必须放在前面，否则父类会先捕获导致子类不可达。" },
  { id: 'j67', moduleId: 'module-4', type: 'short', difficulty: 'easy', category: 'core', tags: ['exceptions'], question: "手动抛出异常使用 ___ 关键字。", sampleAnswer: "throw", explanation: "throw new Exception();" },
  { id: 'j68', moduleId: 'module-4', type: 'short', difficulty: 'easy', category: 'core', tags: ['exceptions'], question: "try-catch 块后可以跟一个可选的 ___ 块，用于清理资源。", sampleAnswer: "finally", explanation: "finally 总是执行。" },
  { id: 'j87', moduleId: 'module-4', type: 'short', difficulty: 'easy', category: 'core', tags: ['exceptions'], question: "严重的问题如 OutOfMemoryError 是 ___ 类的子类，通常不捕获。", sampleAnswer: "Error", explanation: "Error 和 Exception 都继承自 Throwable。" },
  { id: 'j121', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['exceptions'], question: "捕获异常使用的关键字组合是？", options: ["try-catch", "if-else", "for-break", "while-continue"], correctAnswer: "try-catch", explanation: "try-catch-finally 是 Java 异常处理标准结构。" },
  { id: 'j122', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['exceptions', 'errorProne'], question: "无论是否异常都会执行的代码块关键字是？", options: ["catch", "finally", "throw", "throws"], correctAnswer: "finally", explanation: "finally 块必定执行，常用于资源释放。" },
  { id: 'j139', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['exceptions'], question: "运行时异常英文简称是？", options: ["Exception", "RuntimeException", "Error", "Throwable"], correctAnswer: "RuntimeException", explanation: "RuntimeException 为运行时异常，无需强制处理。" },

  // ----- I/O流 (io) -----
  { id: 'j19', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['io'], question: "BufferedReader 相对于 FileReader 的优势是？", options: ["支持二进制文件", "提供了缓冲区，提高读取效率", "可以写入文件", "自动处理编码"], correctAnswer: "提供了缓冲区，提高读取效率", explanation: "BufferedReader 包装低级 Reader，减少实际 IO 次数。" },
  { id: 'j20', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['io'], question: "Java NIO 中的核心组件不包括？", options: ["Channel", "Buffer", "Selector", "OutputStream"], correctAnswer: "OutputStream", explanation: "OutputStream 属于传统 IO，NIO 使用 Channel、Buffer 和 Selector。" },
  { id: 'j39', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['io'], question: "java.nio.file.Paths 类的 get() 方法用于？", options: ["读取文件内容", "创建 Path 实例", "检查文件是否存在", "删除文件"], correctAnswer: "创建 Path 实例", explanation: "Paths.get(String path) 返回一个 Path 对象，用于 NIO 文件操作。" },
  { id: 'j69', moduleId: 'module-4', type: 'short', difficulty: 'easy', category: 'core', tags: ['io'], question: "Java 传统 IO 流的核心包是 java.___。", sampleAnswer: "io", explanation: "java.io 提供 InputStream, OutputStream 等类。" },
  { id: 'j70', moduleId: 'module-4', type: 'short', difficulty: 'easy', category: 'core', tags: ['io'], question: "对象序列化需要实现 ___ 接口。", sampleAnswer: "Serializable", explanation: "标记接口，告诉 JVM 可以将对象转化为字节流。" },
  { id: 'j88', moduleId: 'module-4', type: 'short', difficulty: 'medium', category: 'core', tags: ['io'], question: "Java NIO 的核心包是 java.___。", sampleAnswer: "nio", explanation: "java.nio 提供非阻塞 IO 和选择器等。" },
  { id: 'j125', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['io'], question: "Java IO 流分为字节流和？", options: ["网络流", "字符流", "文件流", "缓存流"], correctAnswer: "字符流", explanation: "IO 流两大分类：字节流、字符流。" },
  { id: 'j126', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['io', 'errorProne'], question: "专门操作文本文件优先使用？", options: ["字节流", "字符流", "对象流", "数据流"], correctAnswer: "字符流", explanation: "字符流针对文本文件，字节流通用所有文件。" },
  { id: 'j141', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['io'], question: "以下哪个类用于描述文件本身？", options: ["FileReader", "File", "BufferedReader", "InputStream"], correctAnswer: "File", explanation: "File 类操作文件路径与属性，不做内容读写。" },

  // ----- 集合框架 (collections) -----
  { id: 'j21', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['collections'], question: "以下哪个 List 实现类底层使用数组？", options: ["ArrayList", "LinkedList", "Vector", "A 和 C"], correctAnswer: "A 和 C", explanation: "ArrayList 和 Vector 底层都是数组，LinkedList 是双向链表。" },
  { id: 'j22', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['collections'], question: "HashSet 判断元素重复的依据是？", options: ["== 运算符", "equals() 和 hashCode()", "compareTo()", "仅 equals()"], correctAnswer: "equals() 和 hashCode()", explanation: "首先计算 hashCode，相同再调用 equals 确认。" },
  { id: 'j40', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['collections'], question: "要实现对象的自然排序，应该实现哪个接口？", options: ["Comparator", "Comparable", "Runnable", "Iterable"], correctAnswer: "Comparable", explanation: "Comparable 定义 compareTo 方法，用于自然排序。" },
  { id: 'j71', moduleId: 'module-4', type: 'short', difficulty: 'easy', category: 'core', tags: ['collections'], question: "键值对存储的顶级接口是 ___。", sampleAnswer: "Map", explanation: "Map 不是 Collection 的子接口，但也是集合框架的一部分。" },
  { id: 'j72', moduleId: 'module-4', type: 'short', difficulty: 'medium', category: 'core', tags: ['collections'], question: "遍历集合的标准设计模式是 ___。", sampleAnswer: "迭代器", explanation: "Iterator 接口提供 hasNext() 和 next() 方法。" },
  { id: 'j89', moduleId: 'module-4', type: 'short', difficulty: 'easy', category: 'core', tags: ['collections'], question: "先进先出（FIFO）的集合接口是 ___。", sampleAnswer: "Queue", explanation: "Queue 通常由 LinkedList 实现。" },
  { id: 'j100', moduleId: 'module-4', type: 'short', difficulty: 'easy', category: 'core', tags: ['collections'], question: "List 接口保证元素的 ___ 顺序。", sampleAnswer: "插入", explanation: "List 是有序集合，允许重复。" },
  { id: 'j123', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['collections'], question: "以下属于有序可重复集合的是？", options: ["ArrayList", "HashSet", "HashMap", "TreeSet"], correctAnswer: "ArrayList", explanation: "List 集合有序可重复，Set 集合无序不可重复。" },
  { id: 'j124', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['collections', 'errorProne'], question: "HashMap 集合中不允许重复的是？", options: ["key", "value", "元素", "地址"], correctAnswer: "key", explanation: "HashMap 的 key 唯一，value 允许重复。" },
  { id: 'j140', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['collections', 'errorProne'], question: "获取集合元素个数使用？", options: ["length", "size()", "count()", "getSize()"], correctAnswer: "size()", explanation: "集合调用 size() 方法获取元素数量。" },

  // ----- 泛型 (generics) -----
  { id: 'j23', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['generics'], question: "Java 泛型是通过什么机制实现的？", options: ["运行时类型识别", "类型擦除", "类型推导", "动态代理"], correctAnswer: "类型擦除", explanation: "泛型信息在编译后被擦除，替换为原始类型和强制转换。" },
  { id: 'j24', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['generics'], question: "通配符 ? extends Number 的含义是？", options: ["只能是 Number 类型", "Number 或其子类", "Number 或其父类", "任何类型"], correctAnswer: "Number 或其子类", explanation: "上界通配符，表示 Number 或 Number 的子类。" },
  { id: 'j41', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['generics'], question: "Java 7 引入的菱形运算符（<>）的作用是？", options: ["类型推断，简化泛型实例化", "创建数组", "位运算", "比较对象"], correctAnswer: "类型推断，简化泛型实例化", explanation: "例如 List<String> list = new ArrayList<>(); 省略右侧类型参数。" },
  { id: 'j73', moduleId: 'module-4', type: 'short', difficulty: 'easy', category: 'core', tags: ['generics'], question: "泛型类型参数通常使用单个大写字母，如 T 表示 Type，E 表示 ___。", sampleAnswer: "Element", explanation: "E 用于集合元素，K 键，V 值。" },
  { id: 'j90', moduleId: 'module-4', type: 'short', difficulty: 'medium', category: 'core', tags: ['generics'], question: "无限制通配符是 ___。", sampleAnswer: "?", explanation: "例如 List<?> 表示未知类型的列表。" },

  // ----- 多线程 (multithreading) -----
  { id: 'j26', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['multithreading'], question: "创建线程的两种主要方式是继承 Thread 类和实现哪个接口？", options: ["Runnable", "Callable", "Threadable", "Executor"], correctAnswer: "Runnable", explanation: "实现 Runnable 接口并传入 Thread 对象。" },
  { id: 'j27', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['multithreading'], question: "Thread.sleep(1000) 可能抛出什么异常？", options: ["InterruptedException", "IllegalMonitorStateException", "RuntimeException", "IOException"], correctAnswer: "InterruptedException", explanation: "sleep 方法可能被中断，抛出 InterruptedException，需要捕获或声明。" },
  { id: 'j43', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['multithreading'], question: "volatile 关键字的主要作用是？", options: ["保证原子性", "保证可见性和禁止指令重排序", "实现线程互斥", "创建新线程"], correctAnswer: "保证可见性和禁止指令重排序", explanation: "volatile 确保变量变化对所有线程可见，但不保证复合操作的原子性。" },
  { id: 'j75', moduleId: 'module-4', type: 'short', difficulty: 'easy', category: 'core', tags: ['multithreading'], question: "启动新线程应调用 Thread 对象的 ___ 方法，而不是直接调用 run()。", sampleAnswer: "start", explanation: "start() 创建新线程并执行 run()，直接调用 run() 只是普通方法调用。" },
  { id: 'j76', moduleId: 'module-4', type: 'short', difficulty: 'medium', category: 'core', tags: ['multithreading'], question: "等待一个线程结束的方法是 ___。", sampleAnswer: "join", explanation: "t.join() 使当前线程阻塞直到 t 结束。" },
  { id: 'j92', moduleId: 'module-4', type: 'short', difficulty: 'medium', category: 'core', tags: ['multithreading'], question: "synchronized 代码块中使用的锁对象可以是任何 ___ 对象。", sampleAnswer: "Java", explanation: "任意对象都可作为内置锁。" },

  // ----- Lambda与Stream (lambda) -----
  { id: 'j28', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['lambda', 'syntax'], question: "以下哪个是 Java 中合法的 Lambda 表达式？", options: ["(int x, int y) -> { return x + y; }", "(x, y) -> return x + y;", "x, y -> x + y", "x -> x*x;"], correctAnswer: "(int x, int y) -> { return x + y; }", explanation: "正确形式：(参数) -> 表达式 或 (参数) -> { 语句; }。选项 A 正确，B 缺少花括号和 return 的写法有误。" },
  { id: 'j29', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['lambda'], question: "Stream API 中的终端操作（terminal operation）是？", options: ["filter", "map", "collect", "limit"], correctAnswer: "collect", explanation: "collect、forEach、reduce 等都是终端操作，触发流处理。filter/map 是中间操作。" },
  { id: 'j44', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['lambda'], question: "方法引用 System.out::println 等价于以下哪个 Lambda 表达式？", options: ["x -> System.out.println(x)", "() -> System.out.println()", "System.out.println(x)", "x -> println(x)"], correctAnswer: "x -> System.out.println(x)", explanation: "方法引用是 Lambda 的简写，参数传递给 println。" },
  { id: 'j77', moduleId: 'module-4', type: 'short', difficulty: 'medium', category: 'core', tags: ['lambda'], question: "如果一个接口只有一个抽象方法，则称为 ___ 接口。", sampleAnswer: "函数式", explanation: "可以使用 @FunctionalInterface 注解检查。" },
  { id: 'j78', moduleId: 'module-4', type: 'short', difficulty: 'medium', category: 'core', tags: ['lambda'], question: "Stream API 中用于将流元素收集到集合的终端操作是 ___。", sampleAnswer: "collect", explanation: "collect(Collectors.toList()) 等。" },
  { id: 'j93', moduleId: 'module-4', type: 'short', difficulty: 'hard', category: 'extension', tags: ['lambda'], question: "将 Stream 转换为并行流可以使用 ___() 方法。", sampleAnswer: "parallel", explanation: "stream.parallel() 或 Collection.parallelStream()。" },

  // ----- 注解 (annotations) -----
  { id: 'j25', moduleId: 'module-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['annotations'], question: "@Override 注解的作用是？", options: ["强制重写父类方法", "检查是否真正重写了父类方法", "提高性能", "生成文档"], correctAnswer: "检查是否真正重写了父类方法", explanation: "标记并让编译器检查该方法是否正确地覆盖了父类方法。" },
  { id: 'j42', moduleId: 'module-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['annotations'], question: "@Retention(RetentionPolicy.RUNTIME) 表示注解会保留到？", options: ["源码级别", "编译后字节码", "运行时可通过反射获取", "仅在测试时"], correctAnswer: "运行时可通过反射获取", explanation: "RUNTIME 保留策略使注解在 JVM 运行时可用。" },
  { id: 'j74', moduleId: 'module-4', type: 'short', difficulty: 'easy', category: 'core', tags: ['annotations'], question: "@Deprecated 注解用于标记已过时的程序元素，编译器会生成 ___ 警告。", sampleAnswer: "弃用", explanation: "提示开发者应避免使用该元素。" },
  { id: 'j91', moduleId: 'module-4', type: 'short', difficulty: 'medium', category: 'core', tags: ['annotations'], question: "@Target 注解用于指定自定义注解可以应用的 ___ 元素类型。", sampleAnswer: "Java", explanation: "例如 METHOD, FIELD, TYPE 等。" },

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

/** 题号 → 题目 映射（评测与 RAG 归因用，避免每次线性查找） */
export const questionById: Record<string, PracticeQuestion> = Object.fromEntries(
  questions.map((q) => [q.id, q]),
);

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
  query?: string;
  tags?: string[];
  difficulty?: PracticeQuestion['difficulty'];
  category?: PracticeQuestion['category'];
  moduleId?: string;
  excludeIds?: string[];
  type?: PracticeQuestion['type'];
}

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

export function filterByStage(stage: CurrentPathStage | null): PracticeQuestion[] {
  if (!stage || !stage.coreKnowledgePoints.length) return questions;

  const matched = questions.filter(q =>
    q.tags.some(t => stage.coreKnowledgePoints.includes(t))
  );

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

export function getWrongAnswerQuestions(practiceState: PracticeState | null): PracticeQuestion[] {
  if (!practiceState || !practiceState.results.length) return [];

  const wrongIds = practiceState.results
    .filter(r => (r.isCorrect !== null || r.aiScore !== undefined) && (r.isCorrect === false || (r.aiScore ?? 100) < 60))
    .map(r => r.questionId);

  return questions.filter(q => wrongIds.includes(q.id));
}

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
      .sort((a, b) => ({ easy: 0, medium: 1, hard: 2 })[a.difficulty] - ({ easy: 0, medium: 1, hard: 2 })[b.difficulty]);
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
    functions: '方法',
    scope: '作用域',
    OOP: '面向对象',
    classes: '类与修饰符',
    inheritance: '继承',
    polymorphism: '多态',
    interfaces: '接口与抽象类',
    exceptions: '异常处理',
    collections: '集合框架',
    generics: '泛型',
    io: 'I/O流',
    multithreading: '多线程',
    lambda: 'Lambda与Stream',
    annotations: '注解',
    errorProne: '易错点',
    studyHabit: '学习习惯',
  };
  return map[tag] || tag;
}

export function getAllTags(): string[] {
  return Object.keys(tagIndex);
}
