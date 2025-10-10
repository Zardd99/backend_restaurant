#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const insertMenuItems_1 = require("../operations/insertMenuItems");
const updateMenuItems_1 = require("../operations/updateMenuItems");
const deleteMenuItems_1 = require("../operations/deleteMenuItems");
const queryMenuItems_1 = require("../operations/queryMenuItems");
const program = new commander_1.Command();
program
    .name("menu-db-cli")
    .description("CLI to manage menu items database")
    .version("1.0.0");
program
    .command("insert")
    .description("Insert menu items")
    .option("-f, --file <path>", "Path to data file")
    .option("-d, --data <data>", "JSON data string")
    .action(async (options) => {
    await (0, insertMenuItems_1.insertMenuItems)(options.file, options.data);
});
program
    .command("update")
    .description("Update menu items")
    .option("-f, --file <path>", "Path to data file")
    .option("-d, --data <data>", "JSON data string")
    .action(async (options) => {
    await (0, updateMenuItems_1.updateMenuItems)(options.file, options.data);
});
program
    .command("delete")
    .description("Delete menu items")
    .option("-f, --file <path>", "Path to data file")
    .option("-i, --id <id>", "Delete by ID")
    .option("-n, --name <name>", "Delete by name")
    .action(async (options) => {
    await (0, deleteMenuItems_1.deleteMenuItems)(options.file, options.id, options.name);
});
program
    .command("query")
    .description("Query menu items")
    .option("-c, --category <category>", "Filter by category")
    .option("-t, --tag <tag>", "Filter by dietary tag")
    .option("-a, --available", "Filter by available items only")
    .action(async (options) => {
    await (0, queryMenuItems_1.queryMenuItems)(options.category, options.tag, options.available);
});
program.parse(process.argv);
//# sourceMappingURL=index.js.map