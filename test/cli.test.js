import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const CLI_PATH = path.resolve('bin/cli.js');

test('CLI should output version correctly', () => {
  const output = execSync(`node "${CLI_PATH}" --version`).toString();
  assert.match(output, /smileu-code-skill version \d+\.\d+\.\d+/);
});

test('CLI should show help menu', () => {
  const output = execSync(`node "${CLI_PATH}" --help`).toString();
  assert.match(output, /Usage:/);
  assert.match(output, /Install commands:/);
  assert.match(output, /6-Phase Pipeline/);
});

test('CLI doctor command should check environment runtimes', () => {
  const output = execSync(`node "${CLI_PATH}" doctor`).toString();
  assert.match(output, /Node\.js/);
  assert.match(output, /Git/);
});

test('CLI list command should list core skills and report comprehensive catalog', () => {
  const output = execSync(`node "${CLI_PATH}" list`).toString();
  assert.match(output, /smileu-code-skill/);
  assert.match(output, /engineering-alignment/);
  assert.match(output, /codebase-knowledge-graph/);
  assert.match(output, /frontend-taste/);
  assert.match(output, /cybersecurity-hardening/);
  assert.match(output, /Total installable skills in the bundled library:/);
});

test('CLI repos command should list synthesized upstream repositories', () => {
  const output = execSync(`node "${CLI_PATH}" repos`).toString();
  assert.match(output, /mattpocock\/skills/);
  assert.match(output, /Graphify-Labs\/graphify/);
  assert.match(output, /Leonxlnx\/taste-skill/);
  assert.match(output, /ruvnet\/ruflo/);
  assert.match(output, /emilkowalski\/skills/);
  assert.match(output, /pbakaus\/impeccable/);
  assert.match(output, /blader\/humanizer/);
  assert.match(output, /mukul975\/Anthropic-Cybersecurity-Skills/);
});

test('CLI motion command should provide physics-based easing curves', () => {
  const output = execSync(`node "${CLI_PATH}" motion`).toString();
  assert.match(output, /ease-out/);
  assert.match(output, /ease-in/);
  assert.match(output, /Framer Motion/);
});

test('CLI security audit should detect 0 vulnerabilities in codebase', () => {
  const output = execSync(`node "${CLI_PATH}" audit`).toString();
  assert.match(output, /0 vulnerabilities found/);
});

test('CLI humanizer should report clean non-cliche documentation', () => {
  const output = execSync(`node "${CLI_PATH}" humanize`).toString();
  assert.match(output, /0 AI cliches found/);
});

test('CLI craft audit should verify anti-slop design and motion', () => {
  const output = execSync(`node "${CLI_PATH}" craft`).toString();
  assert.match(output, /High aesthetic craft verified/);
});

test('CLI swarm should decompose tasks into 5 agent personas', () => {
  const output = execSync(`node "${CLI_PATH}" swarm "Test task"`).toString();
  assert.match(output, /Lead Architect/);
  assert.match(output, /Feature Engineer/);
  assert.match(output, /Design & Motion Specialist/);
  assert.match(output, /Security Guardian/);
  assert.match(output, /Humanizer Editor/);
});
