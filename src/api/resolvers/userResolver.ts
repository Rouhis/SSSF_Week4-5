import {GraphQLError} from 'graphql';
import {Cat, User, UserOutput} from '../../types/DBTypes';
import fetchData from '../../functions/fetchData';
import {MessageResponse} from '../../types/MessageTypes';
import {MyContext} from '../../types/MyContext';

// TODO: create resolvers based on user.graphql
// note: when updating or deleting a user don't send id to the auth server, it will get it from the token. So token needs to be sent with the request to the auth server
// note2: when updating or deleting a user as admin, you need to send user id (dont delete admin btw) and also check if the user is an admin by checking the role from the user object form context

export default {
  Cat: {
    owner: async (parent: Cat): Promise<UserOutput> => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('Auth server URL not found');
      }
      const user = await fetchData<User>(
        process.env.AUTH_URL + '/users/' + parent.owner,
      );
      user.id = user._id;
      return user;
    },
  },
  Query: {
    users: async (): Promise<UserOutput[]> => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('Auth server URL not found');
      }
      const users = await fetchData<User[]>(process.env.AUTH_URL + '/users');
      return users.map((user) => {
        user.id = user._id;
        return user;
      });
    },
    userById: async (
      _parent: undefined,
      args: {id: string},
    ): Promise<UserOutput> => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('Auth server URL not found');
      }
      const user = await fetchData<User>(
        process.env.AUTH_URL + '/users/' + args.id,
      );
      user.id = user._id;
      return user;
    },
    checkToken: async (
      _parent: undefined,
      args: undefined,
      context: MyContext,
    ) => {
      const response = {
        message: 'Token is valid',
        user: context.userdata,
      };
      return response;
    },
  },
  Mutation: {
    register: async (
      _parent: undefined,
      args: {user: Omit<User, 'role'>},
    ): Promise<{user: UserOutput; message: string}> => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('Auth URL not set in .env file');
      }
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args.user),
      };
      console.log('args.user:', args.user);
      const registerResponse = await fetchData<MessageResponse & {data: User}>(
        process.env.AUTH_URL + '/users',
        options,
      );
      console.log('registerResponse:', registerResponse);

      if (!registerResponse.data || !registerResponse.data._id) {
        throw new GraphQLError('User registration failed');
      }

      return {
        user: {...registerResponse.data, id: registerResponse.data._id},
        message: registerResponse.message,
      };
    },
    login: async (
      _parent: undefined,
      args: {credentials: {username: string; password: string}},
    ): Promise<MessageResponse & {token: string; user: UserOutput}> => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('Auth URL not set in .env file');
      }
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args.credentials),
      };

      const loginResponse = await fetchData<
        MessageResponse & {token: string; user: UserOutput}
      >(process.env.AUTH_URL + '/auth/login', options);

      loginResponse.user.id = loginResponse.user._id;

      return loginResponse;
    },
    updateUser: async (
      _parent: undefined,
      args: {user: Omit<User, 'role' | 'password'>},
      context: MyContext,
    ): Promise<{user: UserOutput; message: string}> => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('Auth URL not set in .env file');
      }

      // Check if the user is authenticated
      if (!context.userdata) {
        throw new GraphQLError('User not authenticated');
      }

      const options = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${context.userdata?.token}`,
        },
        body: JSON.stringify(args.user),
      };

      const updateResponse = await fetchData<MessageResponse & {data: User}>(
        process.env.AUTH_URL + '/users/' + context.userdata.user._id,
        options,
      );

      updateResponse.data.id = updateResponse.data._id;

      return {user: updateResponse.data, message: updateResponse.message};
    },
    updateUserAsAdmin: async (
      _parent: undefined,
      args: {id: string; user: Omit<User, 'role' | 'password'>},
      context: MyContext,
    ): Promise<{user: UserOutput; message: string}> => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('Auth URL not set in .env file');
      }

      // Check if the user is an admin
      if (context.userdata?.role !== 'admin') {
        throw new GraphQLError('Only admins can update other users');
      }
      const options = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${context.userdata?.token}`,
        },
        body: JSON.stringify(args.user),
      };

      const updateResponse = await fetchData<MessageResponse & {data: User}>(
        process.env.AUTH_URL + '/users/' + args.id,
        options,
      );

      updateResponse.data.id = updateResponse.data._id;

      return {user: updateResponse.data, message: updateResponse.message};
    },
    deleteUser: async (
      _parent: undefined,
      _args: {},
      context: MyContext,
    ): Promise<{message: string; user: Omit<User, 'role' | 'password'>}> => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('Auth URL not set in .env file');
      }

      // Check if the user is authenticated
      if (!context.userdata) {
        throw new GraphQLError('User not authenticated');
      }

      // Fetch the user before deleting
      const userResponse = await fetchData<{data: User}>(
        process.env.AUTH_URL + '/users/' + context.userdata.user._id,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${context.userdata?.token}`,
          },
        },
      );

      const options = {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${context.userdata?.token}`,
        },
      };

      const deleteResponse = await fetchData<MessageResponse>(
        process.env.AUTH_URL + '/users/' + context.userdata.user._id,
        options,
      );

      return {message: deleteResponse.message, user: userResponse.data};
    },
    deleteUserAsAdmin: async (
      _parent: undefined,
      args: {id: string},
      context: MyContext,
    ): Promise<{message: string; user: Omit<User, 'role' | 'password'>}> => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('Auth URL not set in .env file');
      }

      // Check if the user is an admin
      if (context.userdata?.role !== 'admin') {
        throw new GraphQLError('Only admins can delete other users');
      }

      // Fetch the user before deleting
      const userResponse = await fetchData<{data: User}>(
        process.env.AUTH_URL + '/users/' + args.id,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${context.userdata?.token}`,
          },
        },
      );

      const options = {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${context.userdata?.token}`,
        },
      };

      const deleteResponse = await fetchData<MessageResponse>(
        process.env.AUTH_URL + '/users/' + args.id,
        options,
      );

      return {message: deleteResponse.message, user: userResponse.data};
    },
  },
};
