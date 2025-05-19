const mongoose = require('mongoose');
const { getFeedInstanceFromClassInstance, getPostInstance, fPostToFeed, fCommentToPost, fLikePost, fGetCommentsInPost, fGetPostById, fGetAllPost } = require('./post');

// Mock dependencies
jest.mock('./../../configs/Constants', () => ({
  RES_FORM: (status, data) => ({ status, data })
}));
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mocked-uuid')
}));
jest.mock('csvtojson/v2', () => jest.fn());

// Mock console.log for socket error testing
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

// Mock global.IOConnection
global.IOConnection = {
  notifyNewPost: jest.fn(),
  notifyNewComment: jest.fn(),
  notifyUpdatePost: jest.fn()
};

describe('Post Functions', () => {
  let req, res, next, senderId, classId, postId, feedId;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockClear();

    senderId = new mongoose.Types.ObjectId();
    classId = new mongoose.Types.ObjectId();
    postId = new mongoose.Types.ObjectId();
    feedId = new mongoose.Types.ObjectId();

    // Mock Mongoose models
    const feedInstance = {
      _id: feedId,
      class_ref: classId,
      posts: [],
      save: jest.fn().mockResolvedValue(),
      populate: jest.fn().mockResolvedValue({ _id: feedId, class_ref: classId, posts: [] })
    };
    const postInstance = {
      _id: postId,
      from: senderId,
      content: '',
      comments: [],
      liked: [],
      save: jest.fn().mockResolvedValue(),
      populate: jest.fn().mockResolvedValue({ _id: postId, from: senderId, content: '', comments: [], liked: [] }),
      toHexString: jest.fn().mockReturnValue(postId.toHexString())
    };
    const commentInstance = {
      _id: new mongoose.Types.ObjectId(),
      from: senderId,
      content: '',
      save: jest.fn().mockResolvedValue(),
      populate: jest.fn().mockResolvedValue({ _id: new mongoose.Types.ObjectId(), from: senderId, content: '' })
    };
    const classInstance = {
      _id: classId,
      feed_ref: null,
      save: jest.fn().mockResolvedValue(),
      class_id: 'class123'
    };

    global.DBConnection = {
      Feed: jest.fn().mockImplementation(() => feedInstance),
      Post: jest.fn().mockImplementation(() => postInstance),
      Comment: jest.fn().mockImplementation(() => commentInstance),
      Class: jest.fn().mockImplementation(() => classInstance)
    };

    // Mock findOne for Feed and Post
    global.DBConnection.Feed.findOne = jest.fn().mockResolvedValue(null);
    global.DBConnection.Post.findOne = jest.fn().mockResolvedValue(null);

    // Mock req, res, next
    req = {
      senderInstance: { _id: senderId, toHexString: () => senderId.toHexString() },
      classInstance,
      feedInstance,
      postInstance: null,
      body: {},
      params: { postId, classId }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };
    next = jest.fn();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  const printTestLog = (testName, expected, actual) => {
    process.stdout.write(`Test: ${testName}\n`);
    process.stdout.write(`Expected Output: ${JSON.stringify(expected, null, 2)}\n`);
    process.stdout.write(`Actual Output: ${JSON.stringify(actual, null, 2)}\n\n`);
  };

  describe('getFeedInstanceFromClassInstance', () => {
    // Post01
    it('should find existing feed and call next', async () => {
      const feedInstance = { _id: feedId, class_ref: classId, posts: [] };
      global.DBConnection.Feed.findOne.mockResolvedValue(feedInstance);

      await getFeedInstanceFromClassInstance(req, res, next);

      printTestLog(
        'should find existing feed and call next',
        { nextCalled: 1, feedInstance: { _id: feedId.toString(), class_ref: classId.toString() } },
        {
          nextCalled: next.mock.calls.length,
          feedInstance: req.feedInstance ? { _id: req.feedInstance._id.toString(), class_ref: req.feedInstance.class_ref.toString() } : null
        }
      );

      expect(global.DBConnection.Feed.findOne).toHaveBeenCalledWith({ class_ref: classId });
      expect(req.feedInstance).toBe(feedInstance);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    // Post02
    it('should create new feed if none exists', async () => {
      const newFeed = { _id: feedId, class_ref: classId, posts: [], save: jest.fn().mockResolvedValue() };
      global.DBConnection.Feed.mockImplementationOnce(() => newFeed);

      await getFeedInstanceFromClassInstance(req, res, next);

      printTestLog(
        'should create new feed if none exists',
        {
          nextCalled: 1,
          feedInstance: { _id: feedId.toString(), class_ref: classId.toString() },
          classFeedRef: feedId.toString()
        },
        {
          nextCalled: next.mock.calls.length,
          feedInstance: req.feedInstance ? { _id: req.feedInstance._id.toString(), class_ref: req.feedInstance.class_ref.toString() } : null,
          classFeedRef: req.classInstance.feed_ref ? req.classInstance.feed_ref.toString() : null
        }
      );

      expect(global.DBConnection.Feed.findOne).toHaveBeenCalledWith({ class_ref: classId });
      expect(newFeed.save).toHaveBeenCalled();
      expect(req.classInstance.feed_ref).toEqual(newFeed._id);
      expect(req.classInstance.save).toHaveBeenCalled();
      expect(req.feedInstance).toBe(newFeed);
      expect(next).toHaveBeenCalled();
    });
    // Post03
    it('should handle error when saving new feed', async () => {
      const error = new Error('Feed save error');
      global.DBConnection.Feed.mockImplementationOnce(() => ({
        save: jest.fn().mockRejectedValue(error)
      }));

      await getFeedInstanceFromClassInstance(req, res, next);

      printTestLog(
        'should handle error when saving new feed',
        { status: 400, json: { status: 'Error', data: `Error when creating feed for class. Err: ${error.message}` } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: `Error when creating feed for class. Err: ${error.message}`
      });
      expect(next).not.toHaveBeenCalled();
    });
    // Post04
    it('should handle invalid classInstance._id', async () => {
      req.classInstance._id = 'invalid';

      await getFeedInstanceFromClassInstance(req, res, next);

      printTestLog(
        'should handle invalid classInstance._id',
        { status: 400, json: { status: 'Error', data: expect.stringContaining('BSONError') } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: expect.stringContaining('BSONError')
      });
      expect(next).not.toHaveBeenCalled();
    });
    // Post05
    it('should handle null classInstance', async () => {
      req.classInstance = null;

      await getFeedInstanceFromClassInstance(req, res, next);

      printTestLog(
        'should handle null classInstance',
        { status: 400, json: { status: 'Error', data: expect.stringContaining('Cannot read properties of null') } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: expect.stringContaining('Cannot read properties of null')
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getPostInstance', () => {
    // Post06
    it('should find post and verify it belongs to feed', async () => {
      const postInstance = { _id: postId, toHexString: () => postId.toHexString() };
      req.feedInstance.posts = [postId];
      global.DBConnection.Post.findOne.mockResolvedValue(postInstance);

      await getPostInstance(req, res, next);

      printTestLog(
        'should find post and verify it belongs to feed',
        { nextCalled: 1, postInstance: { _id: postId.toString() } },
        {
          nextCalled: next.mock.calls.length,
          postInstance: req.postInstance ? { _id: req.postInstance._id.toString() } : null
        }
      );

      expect(global.DBConnection.Post.findOne).toHaveBeenCalledWith({ _id: postId });
      expect(req.postInstance).toBe(postInstance);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    // Post07
    it('should handle post not found', async () => {
      global.DBConnection.Post.findOne.mockResolvedValue(null);

      await getPostInstance(req, res, next);

      printTestLog(
        'should handle post not found',
        { status: 404, json: { status: 'Error', data: 'Post not found' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: 'Post not found'
      });
      expect(next).not.toHaveBeenCalled();
    });
    // Post08
    it('should handle post not in feed', async () => {
      const postInstance = { _id: postId, toHexString: () => postId.toHexString() };
      req.feedInstance.posts = [];
      global.DBConnection.Post.findOne.mockResolvedValue(postInstance);

      await getPostInstance(req, res, next);

      printTestLog(
        'should handle post not in feed',
        { status: 404, json: { status: 'Error', data: 'Post found but not in your class' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: 'Post found but not in your class'
      });
      expect(next).not.toHaveBeenCalled();
    });
    // Post09
    it('should handle invalid postId', async () => {
      req.params.postId = 'invalid';

      await getPostInstance(req, res, next);

      printTestLog(
        'should handle invalid postId',
        { status: 404, json: { status: 'Error', data: 'Post not found' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: 'Post not found'
      });
      expect(next).not.toHaveBeenCalled();
    });
    // Post10
    it('should handle null feedInstance', async () => {
      req.feedInstance = null;

      await getPostInstance(req, res, next);

      printTestLog(
        'should handle null feedInstance',
        { status: 404, json: { status: 'Error', data: expect.stringContaining('Cannot read properties of null') } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: expect.stringContaining('Cannot read properties of null')
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('fPostToFeed', () => {
    // Post11
    it('should create and save new post successfully', async () => {
      req.body.content = 'Test post';
      const post = {
        _id: postId,
        from: senderId,
        content: 'Test post',
        comments: [],
        save: jest.fn().mockResolvedValue(),
        populate: jest.fn().mockResolvedValue({
          _id: postId,
          from: senderId,
          content: 'Test post',
          comments: []
        })
      };
      global.DBConnection.Post.mockImplementationOnce(() => post);
      req.feedInstance.save.mockResolvedValue();

      await fPostToFeed(req, res);

      printTestLog(
        'should create and save new post successfully',
        {
          status: 200,
          json: { status: 'Success', data: { _id: postId.toString(), from: senderId.toString(), content: 'Test post', comments: [] } }
        },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(post.save).toHaveBeenCalled();
      expect(req.feedInstance.posts).toContainEqual(post._id);
      expect(req.feedInstance.save).toHaveBeenCalled();
      expect(post.populate).toHaveBeenCalledWith('from');
      expect(global.IOConnection.notifyNewPost).toHaveBeenCalledWith(post, req.classInstance.class_id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'Success', data: post });
    });

    // Post12
    it('should handle empty content', async () => {
      req.body.content = '';
      await fPostToFeed(req, res);

      printTestLog(
        'should handle empty content',
        { status: 400, json: { status: 'Error', data: 'Post content must not be empty' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: 'Post content must not be empty'
      });
    });
    // Post13
    it('should handle null senderInstance', async () => {
      req.senderInstance = null;
      req.body.content = 'Test post';

      await fPostToFeed(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: 'Sender is missing or invalid'
      });
    });


    // Post14
    it('should handle error when saving post', async () => {
      req.body.content = 'Test post';
      const error = new Error('Post save error');
      global.DBConnection.Post.mockImplementationOnce(() => ({
        save: jest.fn().mockRejectedValue(error)
      }));

      await fPostToFeed(req, res);

      printTestLog(
        'should handle error when saving post',
        { status: 400, json: { status: 'Error', data: `Error when creating new post to class feed. Err: ${error.message}` } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: `Error when creating new post to class feed. Err: ${error.message}`
      });
    });
    // Post15
    it('should handle error when saving feed', async () => {
      req.body.content = 'Test post';
      const post = {
        _id: postId,
        save: jest.fn().mockResolvedValue(),
        populate: jest.fn().mockResolvedValue({
          _id: postId,
          from: senderId,
          content: 'Test post',
          comments: []
        })
      };
      global.DBConnection.Post.mockImplementationOnce(() => post);
      const error = new Error('Feed save error');
      req.feedInstance.save.mockRejectedValue(error);

      await fPostToFeed(req, res);

      printTestLog(
        'should handle error when saving feed',
        { status: 400, json: { status: 'Error', data: `Error when push post to feed instance. Err : ${error.message}` } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(post.save).toHaveBeenCalled();
      expect(req.feedInstance.posts).toContainEqual(post._id);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: `Error when push post to feed instance. Err : ${error.message}`
      });
    });
    // Post16
    it('should handle socket notification error', async () => {
      req.body.content = 'Test post';
      const post = {
        _id: postId,
        save: jest.fn().mockResolvedValue(),
        populate: jest.fn().mockRejectedValue(new Error('Populate error'))
      };
      global.DBConnection.Post.mockImplementationOnce(() => post);
      req.feedInstance.save.mockResolvedValue();

      await fPostToFeed(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: expect.stringContaining('Failed to prepare post data')
      });
    });

  });

  describe('fCommentToPost', () => {
    // Post17
    it('should create and save comment successfully', async () => {
      req.body.content = 'Test comment';
      const postInstance = {
        _id: postId,
        comments: [],
        save: jest.fn().mockResolvedValue(),
        populate: jest.fn().mockResolvedValue({
          _id: postId,
          comments: []
        })
      };
      req.postInstance = postInstance;
      const comment = {
        _id: new mongoose.Types.ObjectId(),
        from: senderId,
        content: 'Test comment',
        save: jest.fn().mockResolvedValue(),
        populate: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          from: senderId,
          content: 'Test comment'
        })
      };
      global.DBConnection.Comment.mockImplementationOnce(() => comment);

      await fCommentToPost(req, res);

      printTestLog(
        'should create and save comment successfully',
        {
          status: 200,
          json: { status: 'Success', data: { _id: postId.toString(), comments: expect.any(Array) } }
        },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(comment.save).toHaveBeenCalled();
      expect(req.postInstance.comments).toContainEqual(comment);
      expect(req.postInstance.save).toHaveBeenCalled();
      expect(comment.populate).toHaveBeenCalledWith('from');
      expect(req.postInstance.populate).toHaveBeenCalledWith('comments');
      expect(global.IOConnection.notifyNewComment).toHaveBeenCalledWith(comment, postId, req.classInstance.class_id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'Success', data: postInstance });
    });
    // Post18
    it('should handle empty comment content', async () => {
      req.body.content = '';
      req.postInstance = { _id: postId, comments: [], save: jest.fn().mockResolvedValue() };

      await fCommentToPost(req, res);

      printTestLog(
        'should handle empty comment content',
        { status: 400, json: { status: 'Error', data: expect.stringContaining('Cannot read properties of undefined') } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: expect.stringContaining('Cannot read properties of undefined')
      });
    });

    // Post19
    it('should handle error when saving comment', async () => {
      req.body.content = 'Test comment';
      const error = new Error('Comment save error');
      global.DBConnection.Comment.mockImplementationOnce(() => ({
        save: jest.fn().mockRejectedValue(error)
      }));
      req.postInstance = { _id: postId, comments: [], save: jest.fn().mockResolvedValue() };

      await fCommentToPost(req, res);

      printTestLog(
        'should handle error when saving comment',
        { status: 400, json: { status: 'Error', data: `Error when creating comment. Err: ${error.message}` } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: `Error when creating comment. Err: ${error.message}`
      });
    });
    // Post20
    it('should handle error when saving post with comment', async () => {
      req.body.content = 'Test comment';
      const postInstance = {
        _id: postId,
        comments: [],
        save: jest.fn().mockRejectedValue(new Error('Post save error')),
        populate: jest.fn().mockResolvedValue({
          _id: postId,
          comments: []
        })
      };
      req.postInstance = postInstance;
      const comment = {
        _id: new mongoose.Types.ObjectId(),
        save: jest.fn().mockResolvedValue(),
        populate: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          from: senderId,
          content: 'Test comment'
        })
      };
      global.DBConnection.Comment.mockImplementationOnce(() => comment);

      await fCommentToPost(req, res);

      printTestLog(
        'should handle error when saving post with comment',
        { status: 400, json: { status: 'Error', data: expect.stringContaining('Error when pushing comment to post') } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(comment.save).toHaveBeenCalled();
      expect(req.postInstance.comments).toContainEqual(comment);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: expect.stringContaining('Error when pushing comment to post')
      });
    });
    // Post21
    it('should handle error when populating comment', async () => {
      req.body.content = 'Test comment';
      const error = new Error('Populate error');
      global.DBConnection.Comment.mockImplementationOnce(() => ({
        save: jest.fn().mockResolvedValue(),
        populate: jest.fn().mockRejectedValue(error)
      }));
      req.postInstance = { _id: postId, comments: [], save: jest.fn().mockResolvedValue() };

      await fCommentToPost(req, res);

      printTestLog(
        'should handle error when populating comment',
        { status: 400, json: { status: 'Error', data: `Error when creating comment. Err: ${error.message}` } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: `Error when creating comment. Err: ${error.message}`
      });
    });
  });

  describe('fLikePost', () => {
    // Post22
    it('should add like if not already liked', async () => {
      const postInstance = {
        _id: postId,
        liked: [],
        save: jest.fn().mockResolvedValue(),
        populate: jest.fn().mockResolvedValue({
          _id: postId,
          liked: [senderId],
          comments: []
        }),
        toHexString: () => postId.toHexString()
      };
      req.postInstance = postInstance;

      await fLikePost(req, res);

      printTestLog(
        'should add like if not already liked',
        { status: 200, json: { status: 'Success', data: '' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(req.postInstance.liked).toContainEqual(senderId);
      expect(req.postInstance.save).toHaveBeenCalled();
      expect(req.postInstance.populate).toHaveBeenCalledWith({
        path: 'comments',
        populate: { path: 'from' }
      });
      expect(req.postInstance.populate).toHaveBeenCalledWith('liked');
      expect(req.postInstance.populate).toHaveBeenCalledWith('from');
      expect(global.IOConnection.notifyUpdatePost).toHaveBeenCalledWith(postInstance, req.classInstance.class_id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'Success', data: '' });
    });
    // Post23
    it('should remove like if already liked', async () => {
      const postInstance = {
        _id: postId,
        liked: [senderId],
        save: jest.fn().mockResolvedValue(),
        populate: jest.fn().mockResolvedValue({
          _id: postId,
          liked: [],
          comments: []
        }),
        toHexString: () => postId.toHexString()
      };
      req.postInstance = postInstance;

      await fLikePost(req, res);

      printTestLog(
        'should remove like if already liked',
        { status: 200, json: { status: 'Success', data: '' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(req.postInstance.liked).not.toContainEqual(senderId);
      expect(req.postInstance.save).toHaveBeenCalled();
      expect(req.postInstance.populate).toHaveBeenCalledWith({
        path: 'comments',
        populate: { path: 'from' }
      });
      expect(req.postInstance.populate).toHaveBeenCalledWith('liked');
      expect(req.postInstance.populate).toHaveBeenCalledWith('from');
      expect(global.IOConnection.notifyUpdatePost).toHaveBeenCalledWith(postInstance, req.classInstance.class_id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'Success', data: '' });
    });

  });

  describe('fGetCommentsInPost', () => {
    // Post24
    it('should return comments for post', async () => {
    const postInstance = {
        _id: postId,
        comments: [{ _id: new mongoose.Types.ObjectId() }],
        populate: jest.fn().mockResolvedValue({
            _id: postId,
            comments: [{ _id: new mongoose.Types.ObjectId() }]
        })
    };
    req.postInstance = postInstance;

    await fGetCommentsInPost(req, res);

    printTestLog(
        'should return comments for post',
        {
            status: 200,
            json: { status: 'Success', data: expect.any(Array) }
        },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
    );

    expect(req.postInstance.populate).toHaveBeenCalledWith({
        path: 'comments',
        populate: { path: 'from' }
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
        status: 'Success',
        data: postInstance.comments 
    });
});
    
  });

  describe('fGetPostById', () => {
    // Post25
    it('should return post with details', async () => {
      const postInstance = {
        _id: postId,
        comments: [],
        from: senderId,
        populate: jest.fn().mockResolvedValue({
          _id: postId,
          comments: [],
          from: senderId
        })
      };
      req.postInstance = postInstance;

      await fGetPostById(req, res);

      printTestLog(
        'should return post with details',
        {
          status: 200,
          json: { status: 'Success', data: { _id: postId.toString(), comments: [], from: senderId.toString() } }
        },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(req.postInstance.populate).toHaveBeenCalledWith('comments');
      expect(req.postInstance.populate).toHaveBeenCalledWith('from');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Success',
        data: postInstance
      });
    });
  
  });

  describe('fGetAllPost', () => {
    // Post26
    it('should return all posts in feed', async () => {
      const post = {
        _id: postId,
        comments: [],
        liked: [],
        from: senderId,
        populate: jest.fn().mockResolvedValue({
          _id: postId,
          comments: [],
          liked: [],
          from: senderId
        }),
        toHexString: () => postId.toHexString()
      };
      req.feedInstance.posts = [post];
      req.feedInstance.populate.mockResolvedValue(req.feedInstance);

      await fGetAllPost(req, res);

      printTestLog(
        'should return all posts in feed',
        {
          status: 200,
          json: { status: 'Sucess', data: expect.any(Array) }
        },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(req.feedInstance.populate).toHaveBeenCalledWith({
        path: 'posts',
        populate: { path: 'from' }
      });
      expect(post.populate).toHaveBeenCalledWith({
        path: 'comments',
        populate: { path: 'from' }
      });
      expect(post.populate).toHaveBeenCalledWith({ path: 'liked' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Sucess',
        data: req.feedInstance.posts
      });
    });
    // Post27
    it('should handle empty feed posts', async () => {
      req.feedInstance.posts = [];
      req.feedInstance.populate.mockResolvedValue(req.feedInstance);

      await fGetAllPost(req, res);

      printTestLog(
        'should handle empty feed posts',
        {
          status: 200,
          json: { status: 'Sucess', data: [] }
        },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(req.feedInstance.populate).toHaveBeenCalledWith({
        path: 'posts',
        populate: { path: 'from' }
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Sucess',
        data: []
      });
    });
    

  });
});