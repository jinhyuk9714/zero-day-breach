# Zero-Day Breach Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a deterministic single-battle cyberpunk deckbuilder prototype with canvas rendering and Playwright validation.

**Architecture:** Use a pure game-state engine for combat rules and a thin Vite-powered browser shell for canvas rendering, input mapping, and exposed testing hooks. Keep the combat deterministic by fixing draw order, intent order, and restart state so automated browser checks can compare text state and screenshots reliably.

**Tech Stack:** Vanilla JavaScript, Vite, Node test runner, Playwright client script from the develop-web-game skill.

---

- Implement the deterministic battle state and transitions first.
- Add the canvas UI and required browser hooks.
- Validate with Node tests, Vite build, and Playwright screenshot/state loops.
