/**
 * 数据库题库 — 统一题目仓库 (135 题)
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
// 数据库基础     — 数据库概念、DB/DBMS/DBS/DBA、数据库系统组成
// SQL基础        — SELECT/INSERT/UPDATE/DELETE、WHERE/ORDER BY/GROUP BY/HAVING/LIMIT/DISTINCT、聚合函数
// 数据库约束      — PRIMARY KEY/FOREIGN KEY/UNIQUE/NOT NULL/CHECK/DEFAULT
// 数据库索引      — 索引类型、B+树、聚簇索引、索引优缺点、覆盖索引
// 数据库事务      — ACID、COMMIT/ROLLBACK、隔离级别、并发问题、MVCC
// 多表查询       — INNER JOIN/LEFT JOIN/RIGHT JOIN/FULL JOIN/CROSS JOIN、子查询
// 数据库设计      — 三大范式(1NF/2NF/3NF)、E-R模型、反范式化
// 数据库运维      — DROP/TRUNCATE/DELETE区别、备份、SQL优化
// 数据库类型      — 关系型vs非关系型、MySQL/Redis、NoSQL、CAP理论

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
  id: 'database-basics',
  name: '数据库基础',
  description: '系统学习数据库核心知识，从基础概念到高级事务与运维',
  modules: [
    {
      id: 'module-db-1',
      name: '数据库基础与SQL',
      description: '数据库核心概念、SQL增删改查、聚合函数与分组排序',
      tags: ['数据库基础', 'SQL基础'],
    },
    {
      id: 'module-db-2',
      name: '约束与索引',
      description: '主键、外键、唯一约束、索引原理与优化',
      tags: ['数据库约束', '数据库索引'],
    },
    {
      id: 'module-db-3',
      name: '事务与多表查询',
      description: 'ACID特性、事务隔离级别、JOIN连接与子查询',
      tags: ['数据库事务', '多表查询'],
    },
    {
      id: 'module-db-4',
      name: '设计运维与数据库类型',
      description: '三大范式、E-R模型、数据库运维优化、关系型vs非关系型',
      tags: ['数据库设计', '数据库运维', '数据库类型'],
    },
  ],
};

// ==================== 全部题目 ====================

export const questions: PracticeQuestion[] = [

  // ═══════════════════ module-db-1: 数据库基础与SQL ═══════════════════

  // ----- 数据库基础 -----
  { id: 'db-q1', moduleId: 'module-db-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['数据库基础'], question: '数据库的英文缩写是？', options: ['DB', 'DBS', 'DBMS', 'DBA'], correctAnswer: 'DB', explanation: 'DB（Database）为数据库，DBS是数据库系统，DBMS是数据库管理系统，DBA是数据库管理员。' },
  { id: 'db-q2', moduleId: 'module-db-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['数据库基础'], question: '数据库管理系统的英文缩写是？', options: ['DB', 'DBS', 'DBMS', 'DBA'], correctAnswer: 'DBMS', explanation: 'DBMS（Database Management System）即数据库管理系统，是管理数据库的核心软件。' },
  { id: 'db-q3', moduleId: 'module-db-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['数据库基础'], question: '以下不属于数据库三大范式作用的是？', options: ['减少数据冗余', '避免数据异常', '提升数据安全性', '简化数据维护'], correctAnswer: '提升数据安全性', explanation: '数据库三大范式主要用于规范表结构，减少冗余、更新删除异常，优化维护，与数据安全无关。' },

  // ----- SQL基础 (SELECT/INSERT/UPDATE/DELETE) -----
  { id: 'db-q4', moduleId: 'module-db-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SQL中用于查询数据的关键字是？', options: ['INSERT', 'SELECT', 'UPDATE', 'DELETE'], correctAnswer: 'SELECT', explanation: 'SELECT是SQL数据查询核心语句，用于从数据表中检索数据。' },
  { id: 'db-q5', moduleId: 'module-db-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SQL中用于插入新数据的语句是？', options: ['INSERT', 'SELECT', 'UPDATE', 'DELETE'], correctAnswer: 'INSERT', explanation: 'INSERT语句用于向数据表中新增一行或多行数据记录。' },
  { id: 'db-q6', moduleId: 'module-db-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SQL中用于修改表中已有数据的语句是？', options: ['INSERT', 'SELECT', 'UPDATE', 'DELETE'], correctAnswer: 'UPDATE', explanation: 'UPDATE语句用于更新数据表中满足条件的字段数据。' },
  { id: 'db-q7', moduleId: 'module-db-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SQL中用于删除表中数据的语句是？', options: ['DROP', 'TRUNCATE', 'UPDATE', 'DELETE'], correctAnswer: 'DELETE', explanation: 'DELETE用于删除表中指定数据，DROP删除表结构，TRUNCATE清空表所有数据。' },
  { id: 'db-q8', moduleId: 'module-db-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['SQL基础'], question: '以下哪个关键字用于SQL条件筛选？', options: ['ORDER BY', 'WHERE', 'GROUP BY', 'LIMIT'], correctAnswer: 'WHERE', explanation: 'WHERE子句用于指定查询、更新、删除的条件，筛选符合要求的数据。' },
  { id: 'db-q9', moduleId: 'module-db-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SQL中用于排序的关键字是？', options: ['WHERE', 'GROUP BY', 'ORDER BY', 'DISTINCT'], correctAnswer: 'ORDER BY', explanation: 'ORDER BY用于对查询结果进行升序（ASC）或降序（DESC）排序。' },
  { id: 'db-q10', moduleId: 'module-db-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SQL中用于去重的关键字是？', options: ['UNIQUE', 'DISTINCT', 'FILTER', 'SORT'], correctAnswer: 'DISTINCT', explanation: 'DISTINCT关键字可去除查询结果中的重复数据行。' },

  // ----- SQL基础 (聚合函数/分组) -----
  { id: 'db-q11', moduleId: 'module-db-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: '以下哪个函数用于统计数据行数？', options: ['SUM()', 'COUNT()', 'MAX()', 'AVG()'], correctAnswer: 'COUNT()', explanation: 'COUNT()为聚合函数，用于统计查询结果的记录行数。' },
  { id: 'db-q12', moduleId: 'module-db-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: '以下哪个函数用于计算平均值？', options: ['SUM()', 'COUNT()', 'MAX()', 'AVG()'], correctAnswer: 'AVG()', explanation: 'AVG()聚合函数用于计算指定字段数据的平均值。' },
  { id: 'db-q13', moduleId: 'module-db-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SUM()函数的作用是？', options: ['统计行数', '求和', '求最大值', '去重'], correctAnswer: '求和', explanation: 'SUM()聚合函数用于计算指定字段所有数值的总和。' },
  { id: 'db-q14', moduleId: 'module-db-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['SQL基础'], question: 'GROUP BY的作用是？', options: ['数据排序', '数据分组', '数据筛选', '数据去重'], correctAnswer: '数据分组', explanation: 'GROUP BY子句用于根据指定字段对查询结果进行分组，常搭配聚合函数使用。' },
  { id: 'db-q15', moduleId: 'module-db-1', type: 'choice', difficulty: 'medium', category: 'core', tags: ['SQL基础'], question: '分组后筛选数据需要使用哪个子句？', options: ['WHERE', 'HAVING', 'LIMIT', 'DISTINCT'], correctAnswer: 'HAVING', explanation: 'WHERE用于分组前筛选，HAVING用于GROUP BY分组后的条件筛选。' },
  { id: 'db-q16', moduleId: 'module-db-1', type: 'choice', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'LIMIT关键字的作用是？', options: ['条件筛选', '排序', '限制查询结果条数', '分组'], correctAnswer: '限制查询结果条数', explanation: 'LIMIT子句用于限制SQL查询返回的数据行数，常用于分页场景。' },

  // ----- SQL基础 (判断题) -----
  { id: 'db-q17', moduleId: 'module-db-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SELECT语句可以单独执行，无需搭配其他子句。', trueFalseAnswer: true, explanation: '简单的SELECT * FROM 表名 可直接查询表中所有数据，无需额外子句。' },
  { id: 'db-q18', moduleId: 'module-db-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'UPDATE语句不添加WHERE条件时，会更新表中所有数据。', trueFalseAnswer: true, explanation: 'UPDATE无WHERE条件会匹配全表数据，批量更新所有记录，操作风险极高。' },
  { id: 'db-q19', moduleId: 'module-db-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'DELETE语句可以删除数据表的结构。', trueFalseAnswer: false, explanation: 'DELETE仅删除表数据，DROP语句才会删除数据表结构。' },
  { id: 'db-q20', moduleId: 'module-db-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'HAVING子句可以单独使用，无需搭配GROUP BY。', trueFalseAnswer: false, explanation: 'HAVING是分组后筛选子句，必须依托GROUP BY分组使用。' },
  { id: 'db-q21', moduleId: 'module-db-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'COUNT(*) 会统计包含NULL值的所有行数。', trueFalseAnswer: true, explanation: 'COUNT(*)统计全表行数，不忽略空值；COUNT(字段)会忽略字段NULL值。' },
  { id: 'db-q22', moduleId: 'module-db-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'DISTINCT可以对单个或多个字段组合去重。', trueFalseAnswer: true, explanation: 'DISTINCT支持多字段去重，仅当所有字段值均相同时判定为重复数据。' },
  { id: 'db-q23', moduleId: 'module-db-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'ORDER BY 默认排序方式为升序。', trueFalseAnswer: true, explanation: 'ORDER BY 默认ASC升序排序，可手动指定DESC降序。' },
  { id: 'db-q24', moduleId: 'module-db-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'LIMIT 2,3 表示取第2到第5条数据。', trueFalseAnswer: false, explanation: 'LIMIT 偏移量,条数，2,3代表偏移2条，取后续3条数据（第3、4、5条）。' },
  { id: 'db-q25', moduleId: 'module-db-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'MAX()函数可以获取字段最大值。', trueFalseAnswer: true, explanation: 'MAX()聚合函数用于查询指定字段的最大数值。' },
  { id: 'db-q26', moduleId: 'module-db-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SQL语句不区分大小写。', trueFalseAnswer: true, explanation: 'SQL关键字大小写不敏感，书写大写、小写均可，行业常用大写关键字。' },

  // ----- 数据库基础 (判断题) -----
  { id: 'db-q27', moduleId: 'module-db-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['数据库基础'], question: '数据库系统包含数据库、数据库管理系统、管理员和应用程序。', trueFalseAnswer: true, explanation: '完整的数据库系统（DBS）由硬件、数据库、DBMS、DBA和应用系统共同组成。' },
  { id: 'db-q28', moduleId: 'module-db-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['数据库基础'], question: '数据冗余一定是有害的，需要完全消除。', trueFalseAnswer: false, explanation: '适度数据冗余可提升查询效率，完全消除冗余会导致表拆分过细，增加联表查询开销。' },
  { id: 'db-q29', moduleId: 'module-db-1', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['数据库基础'], question: '数据库的核心目的是高效存储和管理数据。', trueFalseAnswer: true, explanation: '数据库通过规范化结构、索引、事务等机制，实现数据高效存储、查询、管理。' },

  // ----- SQL基础 (简答题) -----
  { id: 'db-q30', moduleId: 'module-db-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: '简述SQL中DELETE和TRUNCATE的区别。', sampleAnswer: '1.执行方式：DELETE逐行删除数据，TRUNCATE直接清空数据页；2.事务支持：DELETE记录日志可回滚，TRUNCATE不记录日志不可回滚；3.效率：TRUNCATE远快于DELETE；4.约束：DELETE可触发触发器，TRUNCATE不触发；5.自增列：TRUNCATE会重置自增主键，DELETE不会。', explanation: '二者核心差异为执行机制、日志记录、性能和自增列处理。' },
  { id: 'db-q31', moduleId: 'module-db-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: '简述WHERE和HAVING子句的区别。', sampleAnswer: '1.筛选时机：WHERE是分组前筛选原始数据，HAVING是分组后筛选分组结果；2.使用范围：WHERE无需分组，HAVING必须搭配GROUP BY；3.聚合函数：WHERE不能使用聚合函数，HAVING支持聚合函数筛选。', explanation: '核心区别为筛选阶段和聚合函数支持性不同。' },
  { id: 'db-q32', moduleId: 'module-db-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: '简述常用的SQL聚合函数及功能。', sampleAnswer: '1.COUNT()：统计数据行数；2.SUM()：计算数值字段总和；3.AVG()：计算数值字段平均值；4.MAX()：获取字段最大值；5.MIN()：获取字段最小值。', explanation: '聚合函数常与GROUP BY分组语句搭配使用，实现数据统计分析。' },
  { id: 'db-q33', moduleId: 'module-db-1', type: 'short', difficulty: 'easy', category: 'core', tags: ['数据库基础'], question: '简述数据库、数据库管理系统、数据库系统的区别。', sampleAnswer: '1.数据库（DB）：存储数据的容器，是结构化数据的集合；2.数据库管理系统（DBMS）：管理数据库的软件，提供增删改查、事务、索引等功能；3.数据库系统（DBS）：由数据库、DBMS、管理员、硬件、应用程序组成的完整系统，范围最广。', explanation: '三者为包含关系，DBS包含DB和DBMS，是完整的运行体系。' },

  // ═══════════════════ module-db-2: 约束与索引 ═══════════════════

  // ----- 数据库约束 (选择题) -----
  { id: 'db-q34', moduleId: 'module-db-2', type: 'choice', difficulty: 'easy', category: 'core', tags: ['数据库约束'], question: '主键约束的关键字是？', options: ['FOREIGN KEY', 'PRIMARY KEY', 'UNIQUE', 'NOT NULL'], correctAnswer: 'PRIMARY KEY', explanation: 'PRIMARY KEY 定义主键，唯一标识数据表中的每一条记录，非空且唯一。' },
  { id: 'db-q35', moduleId: 'module-db-2', type: 'choice', difficulty: 'easy', category: 'core', tags: ['数据库约束'], question: '外键约束的关键字是？', options: ['FOREIGN KEY', 'PRIMARY KEY', 'UNIQUE', 'CHECK'], correctAnswer: 'FOREIGN KEY', explanation: 'FOREIGN KEY 外键约束，用于关联两张数据表，保证数据参照完整性。' },
  { id: 'db-q36', moduleId: 'module-db-2', type: 'choice', difficulty: 'easy', category: 'core', tags: ['数据库约束'], question: '用于限制字段值唯一的约束是？', options: ['NOT NULL', 'UNIQUE', 'PRIMARY KEY', 'DEFAULT'], correctAnswer: 'UNIQUE', explanation: 'UNIQUE约束保证字段所有值唯一，允许为空，主键约束不允许为空。' },
  { id: 'db-q37', moduleId: 'module-db-2', type: 'choice', difficulty: 'easy', category: 'core', tags: ['数据库约束'], question: '用于限制字段不能为空的约束是？', options: ['NOT NULL', 'UNIQUE', 'CHECK', 'DEFAULT'], correctAnswer: 'NOT NULL', explanation: 'NOT NULL约束强制字段必须赋值，不允许为空值。' },
  { id: 'db-q38', moduleId: 'module-db-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库约束'], question: 'DEFAULT约束的作用是？', options: ['限制唯一', '设置默认值', '非空限制', '范围校验'], correctAnswer: '设置默认值', explanation: 'DEFAULT约束用于为字段指定默认值，插入数据未赋值时自动填充默认值。' },
  { id: 'db-q39', moduleId: 'module-db-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库约束'], question: 'CHECK约束的作用是？', options: ['唯一性校验', '非空校验', '自定义条件校验', '默认值设置'], correctAnswer: '自定义条件校验', explanation: 'CHECK约束可自定义字段取值规则，限制字段数据的有效范围。' },

  // ----- 数据库索引 (选择题) -----
  { id: 'db-q40', moduleId: 'module-db-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库索引'], question: '以下哪种索引查询效率最高？', options: ['普通索引', '唯一索引', '主键索引', '全文索引'], correctAnswer: '主键索引', explanation: '主键索引是聚簇索引，数据与索引绑定，查询速度远快于普通二级索引。' },
  { id: 'db-q41', moduleId: 'module-db-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库索引'], question: '索引的主要作用是？', options: ['加密数据', '加快查询速度', '减少存储空间', '简化表结构'], correctAnswer: '加快查询速度', explanation: '索引通过构建有序数据结构，大幅提升数据库数据查询效率。' },
  { id: 'db-q42', moduleId: 'module-db-2', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库索引'], question: '以下哪种场景不适合建立索引？', options: ['高频查询字段', '主键字段', '高频更新字段', '关联查询字段'], correctAnswer: '高频更新字段', explanation: '索引会降低增删改效率，高频更新字段建立索引会大幅增加数据库开销。' },

  // ----- 数据库约束 (判断题) -----
  { id: 'db-q43', moduleId: 'module-db-2', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['数据库约束'], question: '主键可以为NULL。', trueFalseAnswer: false, explanation: '主键约束兼具非空和唯一特性，主键字段绝对不允许为空值。' },
  { id: 'db-q44', moduleId: 'module-db-2', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['数据库约束'], question: '一张数据表只能有一个主键。', trueFalseAnswer: true, explanation: '数据表仅支持一个主键（可由单个或多个字段组成复合主键）。' },
  { id: 'db-q45', moduleId: 'module-db-2', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['数据库约束'], question: 'UNIQUE约束字段允许存在一个NULL值。', trueFalseAnswer: true, explanation: '唯一约束仅限制非空值唯一，可存储单个空值，多个空值不重复校验。' },
  { id: 'db-q46', moduleId: 'module-db-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库约束'], question: '外键约束可以关联非主键字段。', trueFalseAnswer: false, explanation: '外键必须关联主表的主键或唯一索引字段，保证参照完整性。' },
  { id: 'db-q47', moduleId: 'module-db-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库约束'], question: 'DEFAULT默认值可以为NULL。', trueFalseAnswer: true, explanation: '可通过DEFAULT NULL为字段设置空值默认值。' },
  { id: 'db-q48', moduleId: 'module-db-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库约束'], question: 'CHECK约束可以限制字符串长度。', trueFalseAnswer: true, explanation: 'CHECK支持自定义表达式，可校验字符串长度、数值范围等各类规则。' },

  // ----- 数据库索引 (判断题) -----
  { id: 'db-q49', moduleId: 'module-db-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库索引'], question: '索引可以提升增删改查所有操作的效率。', trueFalseAnswer: false, explanation: '索引提升查询效率，但会降低新增、修改、删除数据的效率。' },
  { id: 'db-q50', moduleId: 'module-db-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库索引'], question: '主键索引属于聚簇索引。', trueFalseAnswer: true, explanation: 'InnoDB存储引擎中，主键索引就是聚簇索引，数据存储在主键索引叶子节点。' },
  { id: 'db-q51', moduleId: 'module-db-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库索引'], question: '数据表索引越多越好。', trueFalseAnswer: false, explanation: '索引会占用存储空间、增加写入开销，需根据业务合理建立，并非越多越好。' },
  { id: 'db-q52', moduleId: 'module-db-2', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库索引'], question: 'NULL值不会被普通索引收录。', trueFalseAnswer: false, explanation: '普通索引会存储NULL值，可查询空值数据。' },

  // ----- 数据库约束 (简答题) -----
  { id: 'db-q53', moduleId: 'module-db-2', type: 'short', difficulty: 'easy', category: 'core', tags: ['数据库约束'], question: '简述数据库五大常用约束及作用。', sampleAnswer: '1.主键约束（PRIMARY KEY）：唯一标识记录，非空且唯一；2.外键约束（FOREIGN KEY）：关联多表，保证数据参照完整性；3.非空约束（NOT NULL）：限制字段不能为空；4.唯一约束（UNIQUE）：保证字段值唯一，允许单个空值；5.默认约束（DEFAULT）：为字段设置默认填充值。', explanation: '五大约束用于规范数据表数据，保证数据完整性、唯一性、有效性。' },
  { id: 'db-q54', moduleId: 'module-db-2', type: 'short', difficulty: 'medium', category: 'core', tags: ['数据库索引'], question: '简述索引的优缺点。', sampleAnswer: '优点：1.大幅提升数据查询效率；2.加速多表联表查询速度；3.通过唯一索引保证数据唯一性。缺点：1.占用额外存储空间；2.降低增、删、改数据的执行效率；3.增加数据库维护开销。', explanation: '索引适用于查询多、更新少的业务场景，需合理创建避免冗余。' },
  { id: 'db-q55', moduleId: 'module-db-2', type: 'short', difficulty: 'medium', category: 'core', tags: ['数据库索引'], question: '简述哪些场景不适合建立索引。', sampleAnswer: '1.数据量极少的数据表，索引开销大于查询收益；2.高频增删改的字段，索引会大幅降低写入效率；3.重复度极高的字段，索引无法有效筛选数据；4.频繁为空的字段，索引利用率极低；5.短时间临时使用的字段。', explanation: '索引需结合业务读写比例合理创建，避免无效索引。' },

  // ═══════════════════ module-db-3: 事务与多表查询 ═══════════════════

  // ----- 数据库事务 (选择题) -----
  { id: 'db-q56', moduleId: 'module-db-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: '以下不属于事务四大特性的是？', options: ['原子性', '一致性', '时效性', '隔离性'], correctAnswer: '时效性', explanation: '事务四大特性为ACID：原子性、一致性、隔离性、持久性，无时效性。' },
  { id: 'db-q57', moduleId: 'module-db-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: '事务ACID中A代表的特性是？', options: ['一致性', '原子性', '隔离性', '持久性'], correctAnswer: '原子性', explanation: 'A（Atomicity）原子性，指事务要么全部执行成功，要么全部回滚。' },
  { id: 'db-q58', moduleId: 'module-db-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: '事务执行成功后永久保存数据的特性是？', options: ['原子性', '一致性', '隔离性', '持久性'], correctAnswer: '持久性', explanation: '持久性（Durability）指事务提交后，数据修改永久生效，不会丢失。' },
  { id: 'db-q59', moduleId: 'module-db-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: '事务提交的关键字是？', options: ['ROLLBACK', 'COMMIT', 'SAVEPOINT', 'SET TRANSACTION'], correctAnswer: 'COMMIT', explanation: 'COMMIT用于提交事务，确认所有数据修改永久生效。' },
  { id: 'db-q60', moduleId: 'module-db-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: '事务回滚的关键字是？', options: ['ROLLBACK', 'COMMIT', 'RETURN', 'BACK'], correctAnswer: 'ROLLBACK', explanation: 'ROLLBACK用于回滚事务，撤销本次事务所有未提交的数据修改。' },

  // ----- 多表查询 (选择题) -----
  { id: 'db-q61', moduleId: 'module-db-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['多表查询'], question: '查询两张表交集数据的连接方式是？', options: ['LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN'], correctAnswer: 'INNER JOIN', explanation: 'INNER JOIN 内连接，只返回两张表中匹配成功的交集数据。' },
  { id: 'db-q62', moduleId: 'module-db-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['多表查询'], question: '返回左表所有数据，右表匹配数据的连接是？', options: ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'CROSS JOIN'], correctAnswer: 'LEFT JOIN', explanation: '左连接（LEFT JOIN）保留左表全部数据，右表无匹配则显示NULL。' },
  { id: 'db-q63', moduleId: 'module-db-3', type: 'choice', difficulty: 'medium', category: 'core', tags: ['多表查询'], question: 'FULL JOIN 的作用是？', options: ['仅左表数据', '仅右表数据', '两表所有数据', '两表交集数据'], correctAnswer: '两表所有数据', explanation: '全连接（FULL JOIN）返回左表和右表中所有数据，无匹配项填充NULL。' },

  // ----- 数据库事务 (判断题) -----
  { id: 'db-q64', moduleId: 'module-db-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: '事务的原子性指事务操作不可分割。', trueFalseAnswer: true, explanation: '原子性要求事务所有操作要么全部成功提交，要么全部失败回滚。' },
  { id: 'db-q65', moduleId: 'module-db-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: '未提交的事务数据，所有客户端都可以查询到。', trueFalseAnswer: false, explanation: '数据库事务具备隔离性，未提交的脏数据，其他客户端无法查询。' },
  { id: 'db-q66', moduleId: 'module-db-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: 'COMMIT提交后的事务数据永久生效。', trueFalseAnswer: true, explanation: '事务提交后满足持久性特性，数据修改永久保存，不会丢失。' },
  { id: 'db-q67', moduleId: 'module-db-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: '事务隔离级别可以解决脏读、幻读等问题。', trueFalseAnswer: true, explanation: '数据库四种隔离级别，可逐级解决脏读、不可重复读、幻读问题。' },

  // ----- 多表查询 (判断题) -----
  { id: 'db-q68', moduleId: 'module-db-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['多表查询'], question: 'INNER JOIN 会保留左表所有不匹配数据。', trueFalseAnswer: false, explanation: 'INNER JOIN仅返回两表匹配数据，不匹配数据全部过滤。' },
  { id: 'db-q69', moduleId: 'module-db-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['多表查询'], question: 'LEFT JOIN 查询结果可能包含NULL值。', trueFalseAnswer: true, explanation: '左表数据无右表匹配项时，右表字段会填充NULL值。' },
  { id: 'db-q70', moduleId: 'module-db-3', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['多表查询'], question: '多表查询必须使用JOIN语句。', trueFalseAnswer: false, explanation: '可通过逗号分隔多表+WHERE关联条件实现联表查询，等价于内连接。' },

  // ----- 数据库事务 (简答题) -----
  { id: 'db-q71', moduleId: 'module-db-3', type: 'short', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: '简述事务ACID四大特性。', sampleAnswer: '1.原子性（Atomicity）：事务操作不可分割，要么全成功、要么全回滚；2.一致性（Consistency）：事务执行前后，数据库数据完整性约束不变；3.隔离性（Isolation）：多个事务并发执行互不干扰，相互隔离；4.持久性（Durability）：事务提交后，数据修改永久生效，断电不丢失。', explanation: 'ACID是关系型数据库事务的核心标准，保障并发数据安全。' },
  { id: 'db-q72', moduleId: 'module-db-3', type: 'short', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: '简述数据库事务的三种并发问题。', sampleAnswer: '1.脏读：一个事务读取到另一个事务未提交的脏数据；2.不可重复读：同一事务内，多次读取同一数据，结果被其他已提交事务修改，读取结果不一致；3.幻读：同一事务内，其他事务新增或删除数据，导致当前事务查询结果出现数据行数变化。', explanation: '可通过调整事务隔离级别解决三种并发问题。' },
  { id: 'db-q73', moduleId: 'module-db-3', type: 'short', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: '简述MySQL四种事务隔离级别。', sampleAnswer: '1.读未提交：最低级别，允许读取未提交数据，存在脏读、不可重复读、幻读；2.读已提交：只能读取已提交数据，解决脏读，存在不可重复读、幻读；3.可重复读：同一事务多次读取结果一致，解决脏读、不可重复读，存在幻读（MySQL默认级别）；4.串行化：最高级别，事务串行执行，解决所有并发问题，性能最低。', explanation: '隔离级别越高，数据一致性越强，并发性能越低。' },
  { id: 'db-q74', moduleId: 'module-db-3', type: 'short', difficulty: 'medium', category: 'core', tags: ['多表查询'], question: '简述内连接、左连接、右连接的区别。', sampleAnswer: '1.内连接（INNER JOIN）：只返回两张表中匹配成功的交集数据，无匹配则不展示；2.左连接（LEFT JOIN）：保留左表所有数据，匹配右表数据，无匹配则右表字段为NULL；3.右连接（RIGHT JOIN）：保留右表所有数据，匹配左表数据，无匹配则左表字段为NULL。', explanation: '三者核心差异为保留数据范围，适用于不同联表查询场景。' },

  // ═══════════════════ module-db-4: 设计运维与数据库类型 ═══════════════════

  // ----- 数据库设计 (选择题) -----
  { id: 'db-q75', moduleId: 'module-db-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库设计'], question: '数据库表中不可再分的最小数据单元称为？', options: ['字段', '记录', '数据项', '数据表'], correctAnswer: '数据项', explanation: '数据项是数据库中最基础、不可拆分的数据单元，是表结构的最小组成部分。' },
  { id: 'db-q76', moduleId: 'module-db-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库设计'], question: 'E-R图中，矩形代表的是？', options: ['实体', '属性', '联系', '主键'], correctAnswer: '实体', explanation: 'E-R图规范：矩形表示实体，椭圆形表示属性，菱形表示实体联系。' },
  { id: 'db-q77', moduleId: 'module-db-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库设计'], question: 'E-R图中菱形代表的是？', options: ['实体', '属性', '联系', '外键'], correctAnswer: '联系', explanation: 'E-R图中菱形用于表示不同实体之间的关联关系。' },

  // ----- 数据库运维 (选择题) -----
  { id: 'db-q78', moduleId: 'module-db-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库运维'], question: '以下哪个语句用于删除数据表结构？', options: ['DELETE TABLE', 'DROP TABLE', 'TRUNCATE TABLE', 'CLEAR TABLE'], correctAnswer: 'DROP TABLE', explanation: 'DROP TABLE 彻底删除数据表结构及所有数据，无法恢复。' },
  { id: 'db-q79', moduleId: 'module-db-4', type: 'choice', difficulty: 'medium', category: 'core', tags: ['数据库运维'], question: 'TRUNCATE TABLE 和 DELETE 的主要区别是？', options: ['仅删除数据', '删除表结构', 'TRUNCATE无日志、不可回滚', '无区别'], correctAnswer: 'TRUNCATE无日志、不可回滚', explanation: 'DELETE逐条删除、记录日志可回滚；TRUNCATE清空表数据，不记录日志、无法回滚。' },

  // ----- 数据库类型 (选择题) -----
  { id: 'db-q80', moduleId: 'module-db-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['数据库类型'], question: 'MySQL属于什么类型的数据库？', options: ['层次型', '网状型', '关系型', '非关系型'], correctAnswer: '关系型', explanation: 'MySQL、Oracle、SQL Server均为主流关系型数据库，基于二维表存储数据。' },
  { id: 'db-q81', moduleId: 'module-db-4', type: 'choice', difficulty: 'easy', category: 'core', tags: ['数据库类型'], question: 'Redis属于什么类型的数据库？', options: ['关系型', '键值对非关系型', '层次型', '网状型'], correctAnswer: '键值对非关系型', explanation: 'Redis是基于内存的键值对NoSQL非关系型数据库，读写速度极快。' },

  // ----- 数据库设计 (判断题) -----
  { id: 'db-q82', moduleId: 'module-db-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库设计'], question: '第一范式要求字段不可再分。', trueFalseAnswer: true, explanation: '1NF核心规则：所有字段为原子值，不可拆分、无复合数据。' },
  { id: 'db-q83', moduleId: 'module-db-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库设计'], question: '第二范式消除了非主键字段对主键的传递依赖。', trueFalseAnswer: false, explanation: '第二范式消除部分依赖，第三范式消除传递依赖。' },
  { id: 'db-q84', moduleId: 'module-db-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库设计'], question: 'E-R图可以用于数据库概念结构设计。', trueFalseAnswer: true, explanation: 'E-R模型是数据库概念设计的核心工具，用于梳理实体、属性、联系。' },
  { id: 'db-q85', moduleId: 'module-db-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库设计'], question: '三大范式可以完全杜绝所有数据异常。', trueFalseAnswer: false, explanation: '三大范式可大幅减少数据异常，部分场景需牺牲范式保留冗余，提升性能。' },

  // ----- 数据库运维 (判断题) -----
  { id: 'db-q86', moduleId: 'module-db-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库运维'], question: 'TRUNCATE操作速度比DELETE更快。', trueFalseAnswer: true, explanation: 'TRUNCATE直接清空数据页，不逐行记录日志，执行效率远高于DELETE。' },
  { id: 'db-q87', moduleId: 'module-db-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库运维'], question: 'DROP操作的数据可以通过事务回滚恢复。', trueFalseAnswer: false, explanation: 'DROP属于DDL语句，隐式提交事务，删除后无法回滚恢复。' },
  { id: 'db-q88', moduleId: 'module-db-4', type: 'truefalse', difficulty: 'medium', category: 'core', tags: ['数据库运维'], question: '数据库备份可以防止数据丢失。', trueFalseAnswer: true, explanation: '定期数据备份是数据库容灾、防止数据误删丢失的核心手段。' },

  // ----- 数据库类型 (判断题) -----
  { id: 'db-q89', moduleId: 'module-db-4', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['数据库类型'], question: '关系型数据库基于二维数据表存储数据。', trueFalseAnswer: true, explanation: '关系型数据库以行和列的二维表格形式组织、存储和管理数据。' },
  { id: 'db-q90', moduleId: 'module-db-4', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['数据库类型'], question: 'NoSQL数据库完全不支持事务。', trueFalseAnswer: false, explanation: '部分NoSQL数据库支持简单事务，仅不支持关系型数据库的完整ACID事务。' },
  { id: 'db-q91', moduleId: 'module-db-4', type: 'truefalse', difficulty: 'easy', category: 'core', tags: ['数据库类型'], question: 'Oracle是开源免费的关系型数据库。', trueFalseAnswer: false, explanation: 'Oracle为商用收费数据库，MySQL是开源免费主流关系型数据库。' },

  // ----- 数据库设计 (简答题) -----
  { id: 'db-q92', moduleId: 'module-db-4', type: 'short', difficulty: 'medium', category: 'core', tags: ['数据库设计'], question: '简述数据库三大范式的核心规则。', sampleAnswer: '1.第一范式（1NF）：字段具有原子性，不可拆分，无复合数据；2.第二范式（2NF）：满足1NF，消除非主键字段对主键的部分函数依赖；3.第三范式（3NF）：满足2NF，消除非主键字段对主键的传递函数依赖。', explanation: '三大范式逐级优化表结构，减少数据冗余和更新异常。' },
  { id: 'db-q93', moduleId: 'module-db-4', type: 'short', difficulty: 'medium', category: 'core', tags: ['数据库设计'], question: '简述E-R模型的三大组成要素。', sampleAnswer: '1.实体：现实中独立存在的事物，对应数据表，E-R图用矩形表示；2.属性：实体的特征和参数，对应表字段，E-R图用椭圆形表示；3.联系：不同实体之间的关联关系，分为一对一、一对多、多对多，E-R图用菱形表示。', explanation: 'E-R三要素是数据库概念设计的基础，可快速梳理业务数据关系。' },
  { id: 'db-q94', moduleId: 'module-db-4', type: 'short', difficulty: 'medium', category: 'core', tags: ['数据库运维'], question: '简述数据库常用优化方式。', sampleAnswer: '1.SQL优化：避免SELECT *、合理使用索引、优化JOIN和子查询；2.索引优化：为高频查询字段建索引、删除无效索引；3.表结构优化：遵循三大范式、合理拆分大表、优化字段数据类型；4.配置优化：调整数据库连接数、缓存参数；5.架构优化：主从分离、读写分离、分库分表。', explanation: '数据库优化从SQL、索引、结构、配置、架构多维度落地。' },
  { id: 'db-q95', moduleId: 'module-db-4', type: 'short', difficulty: 'medium', category: 'core', tags: ['数据库类型'], question: '简述关系型数据库和非关系型数据库的区别。', sampleAnswer: '1.存储结构：关系型基于二维表存储，结构固定；非关系型基于键值、文档、图等结构，灵活松散；2.事务支持：关系型完整支持ACID事务，非关系型事务能力薄弱；3.扩展性：关系型横向扩展弱，非关系型分布式扩展能力强；4.适用场景：关系型适用于金融、订单等强一致性场景，非关系型适用于海量数据、高并发场景。', explanation: '两类数据库互补，企业业务常组合使用。' },

  // ==================== 填空题 40道（type: fill） ====================

  // ----- SQL基础 填空题 -----
  { id: 'db-q96', moduleId: 'module-db-1', type: 'fill', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SQL中查询数据的核心语句是______。', fillAnswer: 'SELECT', explanation: 'SELECT是数据查询DQL语句的核心关键字。' },
  { id: 'db-q97', moduleId: 'module-db-1', type: 'fill', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SQL中插入数据的语句是______。', fillAnswer: 'INSERT', explanation: 'INSERT INTO 表名(字段) VALUES(值) 为标准插入语法。' },
  { id: 'db-q98', moduleId: 'module-db-1', type: 'fill', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SQL中更新数据的语句是______。', fillAnswer: 'UPDATE', explanation: 'UPDATE用于修改数据表中已存在的记录数据。' },
  { id: 'db-q99', moduleId: 'module-db-1', type: 'fill', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SQL中删除数据的语句是______。', fillAnswer: 'DELETE', explanation: 'DELETE用于删除表中指定条件的数据记录。' },
  { id: 'db-q100', moduleId: 'module-db-1', type: 'fill', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: '查询结果去重的关键字是______。', fillAnswer: 'DISTINCT', explanation: 'DISTINCT可去除查询结果中的重复数据行。' },
  { id: 'db-q101', moduleId: 'module-db-1', type: 'fill', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: '对查询结果降序排序的关键字是______。', fillAnswer: 'DESC', explanation: 'ORDER BY 字段 DESC 实现降序排序，ASC为升序。' },
  { id: 'db-q102', moduleId: 'module-db-1', type: 'fill', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: '限制查询结果条数的关键字是______。', fillAnswer: 'LIMIT', explanation: 'LIMIT常用于数据库分页查询场景。' },
  { id: 'db-q103', moduleId: 'module-db-1', type: 'fill', difficulty: 'medium', category: 'core', tags: ['SQL基础'], question: '分组后筛选数据需要使用______子句。', fillAnswer: 'HAVING', explanation: 'HAVING适配GROUP BY分组后的条件筛选。' },
  { id: 'db-q104', moduleId: 'module-db-1', type: 'fill', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: 'SQL中用于从表中选取数据的语句是______。', fillAnswer: 'SELECT', explanation: 'SELECT是查询核心。' },
  { id: 'db-q105', moduleId: 'module-db-1', type: 'fill', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: '在WHERE子句中，判断列值是否为NULL应使用______操作符。', fillAnswer: 'IS NULL', explanation: '不能用 = NULL。' },
  { id: 'db-q106', moduleId: 'module-db-1', type: 'fill', difficulty: 'easy', category: 'core', tags: ['SQL基础'], question: '为列起别名可以使用______关键字，通常可以省略。', fillAnswer: 'AS', explanation: 'AS用于别名。' },
  { id: 'db-q107', moduleId: 'module-db-1', type: 'fill', difficulty: 'medium', category: 'core', tags: ['SQL基础'], question: 'ORDER BY子句默认的排序方式是______，若要降序需指定DESC。', fillAnswer: 'ASC', explanation: 'ASC升序，DESC降序。' },

  // ----- 数据库约束 填空题 -----
  { id: 'db-q108', moduleId: 'module-db-2', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库约束'], question: '唯一标识数据表记录的约束是______。', fillAnswer: '主键约束', explanation: '主键约束（PRIMARY KEY）是数据表记录的唯一标识。' },
  { id: 'db-q109', moduleId: 'module-db-2', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库约束'], question: '用于关联两张数据表的约束是______。', fillAnswer: '外键约束', explanation: '外键约束保障多表数据的参照完整性。' },
  { id: 'db-q110', moduleId: 'module-db-2', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库约束'], question: '限制字段不能为空的约束关键字是______。', fillAnswer: 'NOT NULL', explanation: 'NOT NULL强制字段必须赋值，不允许空值。' },
  { id: 'db-q111', moduleId: 'module-db-2', type: 'fill', difficulty: 'medium', category: 'core', tags: ['数据库约束'], question: '为字段设置默认值的约束是______。', fillAnswer: 'DEFAULT', explanation: 'DEFAULT约束可自动填充字段默认值。' },
  { id: 'db-q112', moduleId: 'module-db-2', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库约束'], question: '限制列取值范围可以使用______约束。', fillAnswer: 'CHECK', explanation: 'CHECK定义条件。' },
  { id: 'db-q113', moduleId: 'module-db-2', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库约束'], question: '主键的约束条件是值必须______且非空。', fillAnswer: '唯一', explanation: '主键要求唯一且不为NULL。' },

  // ----- 数据库索引 填空题 -----
  { id: 'db-q114', moduleId: 'module-db-2', type: 'fill', difficulty: 'medium', category: 'core', tags: ['数据库索引'], question: 'InnoDB存储引擎的主键索引属于______索引。', fillAnswer: '聚簇', explanation: '聚簇索引将数据与索引绑定，查询效率最高。' },
  { id: 'db-q115', moduleId: 'module-db-2', type: 'fill', difficulty: 'medium', category: 'core', tags: ['数据库索引'], question: '数据库索引的核心作用是______查询效率。', fillAnswer: '提升', explanation: '索引通过有序数据结构，大幅优化数据查询速度。' },
  { id: 'db-q116', moduleId: 'module-db-2', type: 'fill', difficulty: 'medium', category: 'core', tags: ['数据库索引'], question: 'B+树索引中，所有数据记录都存储在______节点中。', fillAnswer: '叶子', explanation: 'B+树的数据都在叶子层。' },
  { id: 'db-q117', moduleId: 'module-db-2', type: 'fill', difficulty: 'medium', category: 'core', tags: ['数据库索引'], question: '一个索引包含了查询所需的所有列而不需要回表，称为______。', fillAnswer: '覆盖索引', explanation: '覆盖索引直接提供查询结果。' },

  // ----- 数据库事务 填空题 -----
  { id: 'db-q118', moduleId: 'module-db-3', type: 'fill', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: '事务的四大特性简称为______。', fillAnswer: 'ACID', explanation: 'ACID对应原子性、一致性、隔离性、持久性。' },
  { id: 'db-q119', moduleId: 'module-db-3', type: 'fill', difficulty: 'medium', category: 'core', tags: ['数据库事务'], question: '事务提交的关键字是______。', fillAnswer: 'COMMIT', explanation: 'COMMIT用于提交事务，使数据修改永久生效。' },
  { id: 'db-q120', moduleId: 'module-db-3', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库事务'], question: '事务中使用______命令永久保存修改，使用ROLLBACK命令撤销修改。', fillAnswer: 'COMMIT', explanation: '提交和回滚是事务控制的基本命令。' },
  { id: 'db-q121', moduleId: 'module-db-3', type: 'fill', difficulty: 'hard', category: 'core', tags: ['数据库事务'], question: 'MySQL InnoDB引擎默认的事务隔离级别是______。', fillAnswer: '可重复读', explanation: 'MySQL默认REPEATABLE READ。' },

  // ----- 多表查询 填空题 -----
  { id: 'db-q122', moduleId: 'module-db-3', type: 'fill', difficulty: 'easy', category: 'core', tags: ['多表查询'], question: '返回两个表中匹配行的连接称为______JOIN，返回左表所有行的连接称为LEFT JOIN。', fillAnswer: 'INNER', explanation: '内连接和外连接的区分。' },
  { id: 'db-q123', moduleId: 'module-db-3', type: 'fill', difficulty: 'medium', category: 'core', tags: ['多表查询'], question: '合并两个查询结果并自动去除重复行的操作符是______。', fillAnswer: 'UNION', explanation: 'UNION去重，UNION ALL不去重。' },

  // ----- 数据库设计 填空题 -----
  { id: 'db-q124', moduleId: 'module-db-4', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库设计'], question: '外键约束保证了数据的______完整性。', fillAnswer: '参照', explanation: '外键实现参照完整性。' },
  { id: 'db-q125', moduleId: 'module-db-4', type: 'fill', difficulty: 'medium', category: 'core', tags: ['数据库设计'], question: '第一范式要求表中的每个属性值都是______的。', fillAnswer: '原子', explanation: '原子性即不可再分。' },
  { id: 'db-q126', moduleId: 'module-db-4', type: 'fill', difficulty: 'medium', category: 'core', tags: ['数据库设计'], question: '为了提高查询性能，故意引入数据冗余称为______。', fillAnswer: '反范式化', explanation: '反范式是性能调优手段。' },
  { id: 'db-q127', moduleId: 'module-db-4', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库设计'], question: 'E-R图中的矩形代表______，椭圆代表属性。', fillAnswer: '实体', explanation: '基本E-R图符号。' },

  // ----- 数据库运维 填空题 -----
  { id: 'db-q128', moduleId: 'module-db-4', type: 'fill', difficulty: 'medium', category: 'core', tags: ['数据库运维'], question: '删除表中所有数据但保留表结构的命令是______。', fillAnswer: 'TRUNCATE', explanation: 'TRUNCATE清空数据，DROP删除表。' },
  { id: 'db-q129', moduleId: 'module-db-4', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库运维'], question: '数据库系统的英文缩写是______。', fillAnswer: 'DBS', explanation: 'DBS（Database System）代表完整的数据库系统。' },
  { id: 'db-q130', moduleId: 'module-db-4', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库运维'], question: '数据库管理员的英文缩写是______。', fillAnswer: 'DBA', explanation: 'DBA（Database Administrator）负责数据库运维、优化、权限管理。' },

  // ----- 数据库类型 填空题 -----
  { id: 'db-q131', moduleId: 'module-db-4', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库类型'], question: 'MongoDB是一种典型的______型NoSQL数据库。', fillAnswer: '文档', explanation: 'MongoDB存储BSON文档。' },
  { id: 'db-q132', moduleId: 'module-db-4', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库类型'], question: 'CAP定理指出，分布式系统最多能同时满足一致性、可用性和______中的两个。', fillAnswer: '分区容错性', explanation: 'P代表Partition Tolerance。' },
  { id: 'db-q133', moduleId: 'module-db-4', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库类型'], question: 'MySQL中用于存储数据库元数据（如表结构）的数据库是______。', fillAnswer: 'information_schema', explanation: 'information_schema是系统库。' },
  { id: 'db-q134', moduleId: 'module-db-4', type: 'fill', difficulty: 'easy', category: 'core', tags: ['数据库类型'], question: '授予用户权限的命令是______，收回权限的命令是REVOKE。', fillAnswer: 'GRANT', explanation: '权限控制的核心命令。' },

  // ----- 综合 填空题 -----
  { id: 'db-q135', moduleId: 'module-db-4', type: 'fill', difficulty: 'medium', category: 'core', tags: ['数据库设计', '数据库类型'], question: '数据库崩溃恢复时，使用______日志重做已提交的事务，使用UNDO日志回滚未提交的事务。', fillAnswer: 'REDO', explanation: 'REDO重做已提交事务，UNDO回滚未提交事务。' },
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
    '数据库基础': '数据库基础',
    'SQL基础': 'SQL基础',
    '数据库约束': '数据库约束',
    '数据库索引': '数据库索引',
    '数据库事务': '数据库事务',
    '多表查询': '多表查询',
    '数据库设计': '数据库设计',
    '数据库运维': '数据库运维',
    '数据库类型': '数据库类型',
  };
  return map[tag] || tag;
}

export function getAllTags(): string[] {
  return Object.keys(tagIndex);
}
