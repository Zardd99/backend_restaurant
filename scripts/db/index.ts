#!/usr/bin/env node

import { Command } from "commander";
import { insertMenuItems } from "../operations/insertMenuItems";
import { updateMenuItems } from "../operations/updateMenuItems";
import { deleteMenuItems } from "../operations/deleteMenuItems";
import { queryMenuItems } from "../operations/queryMenuItems";

const program = new Command();

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
    await insertMenuItems(options.file, options.data);
  });

program
  .command("update")
  .description("Update menu items")
  .option("-f, --file <path>", "Path to data file")
  .option("-d, --data <data>", "JSON data string")
  .action(async (options) => {
    await updateMenuItems(options.file, options.data);
  });

program
  .command("delete")
  .description("Delete menu items")
  .option("-f, --file <path>", "Path to data file")
  .option("-i, --id <id>", "Delete by ID")
  .option("-n, --name <name>", "Delete by name")
  .action(async (options) => {
    await deleteMenuItems(options.file, options.id, options.name);
  });

program
  .command("query")
  .description("Query menu items")
  .option("-c, --category <category>", "Filter by category")
  .option("-t, --tag <tag>", "Filter by dietary tag")
  .option("-a, --available", "Filter by available items only")
  .action(async (options) => {
    await queryMenuItems(options.category, options.tag, options.available);
  });

program.parse(process.argv);
