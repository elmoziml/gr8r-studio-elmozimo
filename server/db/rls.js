export async function setRlsContext(client, userId) {
  await client.query('set local role gr8r_app');
  await client.query("select set_config('app.user_id', $1, true)", [userId]);
}
