'use strict';

const Member = require('../models/Member');

async function getActiveMembers() {
  return Member.find({ active: true }).sort({ name: 1 }).lean();
}

async function getAllMembers() {
  return Member.find().sort({ name: 1 }).lean();
}

async function getMemberById(id) {
  return Member.findById(id).lean();
}

async function createMember(data) {
  const member = new Member(data);
  return member.save();
}

async function updateMember(id, data) {
  return Member.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
}

module.exports = { getActiveMembers, getAllMembers, getMemberById, createMember, updateMember };
