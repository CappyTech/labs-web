'use strict';

const MemberService = require('../services/MemberService');

async function list(req, res, next) {
  try {
    const members = await MemberService.getAllMembers();
    res.render('milkman/members/index', {
      title:       'Members',
      description: 'Milk-round members.',
      members,
    });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, isBuyer } = req.body;
    if (name) await MemberService.createMember({ name: name.trim(), isBuyer: isBuyer === 'on' });
    res.redirect('/milkman/members');
  } catch (err) { next(err); }
}

async function editForm(req, res, next) {
  try {
    const member = await MemberService.getMemberById(req.params.id);
    if (!member) return res.redirect('/milkman/members');
    res.render('milkman/members/edit', {
      title:       `Edit ${member.name}`,
      description: `Edit member ${member.name}.`,
      member,
    });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { name, isBuyer, active } = req.body;
    await MemberService.updateMember(req.params.id, {
      name:    name?.trim(),
      isBuyer: isBuyer === 'on',
      active:  active  === 'on',
    });
    res.redirect('/milkman/members');
  } catch (err) { next(err); }
}

module.exports = { list, create, editForm, update };
