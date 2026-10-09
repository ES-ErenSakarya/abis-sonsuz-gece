delete from characters
where user_id in (select id from "user" where email = 'erensakarya@abis.gece');

delete from account_secrets
where user_id in (select id from "user" where email = 'erensakarya@abis.gece');

delete from "session"
where "userId" in (select id from "user" where email = 'erensakarya@abis.gece');

delete from "account"
where "userId" in (select id from "user" where email = 'erensakarya@abis.gece');

delete from "user"
where email = 'erensakarya@abis.gece';
