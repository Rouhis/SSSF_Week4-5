import {GraphQLError} from 'graphql';
import catModel from '../models/catModel';
import {Cat} from '../../types/DBTypes';
import {MyContext} from '../../types/MyContext';

// TODO: create resolvers based on cat.graphql
// note: when updating or deleting a cat, you need to check if the user is the owner of the cat
// note2: when updating or deleting a cat as admin, you need to check if the user is an admin by checking the role from the user object
// note3: updating and deleting resolvers should be the same for users and admins. Use if statements to check if the user is the owner or an admin

// Query resolvers
export default {
  Query: {
    cats: async (): Promise<Cat[]> => {
      return await catModel.find();
    },
    catById: async (_parent: undefined, args: {id: string}): Promise<Cat> => {
      const cat = await catModel.findById(args.id);
      if (!cat) {
        throw new GraphQLError('Cat not found', {
          extensions: {
            code: 'NOT_FOUND',
          },
        });
      }
      return cat;
    },
    catsByOwner: async (
      _parent: undefined,
      args: {ownerId: string},
    ): Promise<Cat[]> => {
      console.log('ownerId:', args.ownerId);
      const cats = await catModel.find({owner: args.ownerId});
      console.log('cats:', cats);
      if (cats.length === 0) {
        throw new GraphQLError('No cats found', {
          extensions: {
            code: 'NOT_FOUND',
          },
        });
      }
      return cats;
    },
    catsByArea: async (
      _parent: undefined,
      args: {
        topRight: {lat: number; lng: number};
        bottomLeft: {lat: number; lng: number};
      },
    ): Promise<Cat[]> => {
      const {topRight, bottomLeft} = args;

      const cats = await catModel.find({
        location: {
          $geoWithin: {
            $box: [
              [bottomLeft.lng, bottomLeft.lat], // bottom left coordinates
              [topRight.lng, topRight.lat], // top right coordinates
            ],
          },
        },
      });

      return cats;
    },
  },
  Mutation: {
    createCat: async (
      _parent: undefined,
      args: {input: Omit<Cat, '_id'>},
      context: MyContext,
    ): Promise<{message: string; cat?: Cat}> => {
      if (!context.userdata) {
        throw new GraphQLError('Users not authenticated', {
          extensions: {
            code: 'UNAUTHORIZED',
          },
        });
      }
      args.input.owner = context.userdata.user._id;
      const cat = await catModel.create(args.input);
      if (cat) {
        return {message: 'Cat created', cat};
      } else {
        return {message: 'Cat not created'};
      }
    },
    updateCat: async (
      _parent: undefined,
      args: {input: Partial<Cat>; id: string},
      context: MyContext,
    ): Promise<{message: string; cat?: Cat}> => {
      const catForTest = await catModel.findById(args.id);
      console.log('role', context.userdata?.role);
      if (
        !context.userdata ||
        !catForTest ||
        (context.userdata.user._id !== catForTest.owner.toString() &&
          context.userdata.role !== 'admin')
      ) {
        return {
          message: 'User not authorized',
        };
      }
      const cat = await catModel.findByIdAndUpdate(args.id, args.input, {
        new: true,
      });
      console.log('cat:', cat);
      if (cat) {
        return {cat, message: 'Cat updated'};
      } else {
        return {message: 'Cat not updated', cat: undefined};
      }
    },
    deleteCat: async (
      _parent: undefined,
      args: {id: string},
      context: MyContext,
    ): Promise<{message: string; cat?: Cat}> => {
      const cat = await catModel.findById(args.id);
      if (!cat) {
        throw new GraphQLError('Cat not found', {
          extensions: {
            code: 'NOT_FOUND',
          },
        });
      }
      if (
        !context.userdata ||
        !cat ||
        (context.userdata.user._id !== cat.owner.toString() &&
          context.userdata.role !== 'admin')
      ) {
        throw new GraphQLError('Unauthorized', {
          extensions: {
            code: 'UNAUTHORIZED',
          },
        });
      }
      const deletedCat = await catModel.findByIdAndDelete(args.id);
      if (deletedCat) {
        return {message: 'Cat deleted', cat: deletedCat};
      } else {
        return {message: 'Cat not deleted', cat: undefined};
      }
    },
  },
};
