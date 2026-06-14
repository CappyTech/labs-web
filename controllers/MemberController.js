'use strict';

const MemberService = require('../services/MemberService');
const { toDTO, err } = require('./dto');

async function list(req, res, next) {
  try {
    const members = await MemberService.getAllMembers();
    res.json(members.map(toDTO));
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const { name, isBuyer } = req.body;
    if (!name) return err(res, 400, 'VALIDATION', 'name is required');
    const member = await MemberService.createMember({ name, isBuyer: !!isBuyer });
    res.status(201).json(toDTO(member.toObject()));
  } catch (e) { next(e); }
}

async function get(req, res, next) {
  try {
    const member = await MemberService.getMemberById(req.params.id);
    if (!member) return err(res, 404, 'NOT_FOUND', 'Member not found');
    res.json(toDTO(member));
  } catch (e) { next(e); }
}

async function update(req, res, next) {
  try {
    const member = await MemberService.updateMember(req.params.id, req.body);
    if (!member) return err(res, 404, 'NOT_FOUND', 'Member not found');
    res.json(toDTO(member));
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    const member = await MemberService.updateMember(req.params.id, { active: false });
    if (!member) return err(res, 404, 'NOT_FOUND', 'Member not found');
    res.status(204).end();
  } catch (e) { next(e); }
}

module.exports = { list, create, get, update, remove };
