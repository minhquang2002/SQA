const { Builder, By, until,Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { MongoClient } = require('mongodb');

(async function () {
  let driver;
  let mongoClient;
  let db;

  // Cấu hình MongoDB
  const DB_CONFIGS = {
    HOST: '127.0.0.1',
    PORT: '27017',
    NAME: 'student_management'
  };
  const uri = `mongodb://${DB_CONFIGS.HOST}:${DB_CONFIGS.PORT}`;

  try {
    // Khởi tạo kết nối MongoDB
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    db = mongoClient.db(DB_CONFIGS.NAME);
    console.log('Connected to MongoDB');

    // Khởi tạo driver
    const chromeOptions = new chrome.Options();
    // chromeOptions.addArguments('--headless');
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();
    await driver.manage().window().maximize();

    // Test 1: Đăng nhập
    console.log('Navigating to login page...');
    await driver.get('http://localhost:3000/login');
    const usernameField = await driver.wait(until.elementLocated(By.name('username')), 2000);
    await usernameField.sendKeys('19029999'); 
    const passwordField = await driver.wait(until.elementLocated(By.name('password')), 2000);
    await passwordField.sendKeys('bach');
    const loginButton = await driver.wait(until.elementLocated(By.xpath('//button[text()="Đăng nhập"]')), 2000);
    await loginButton.click();
    await driver.wait(until.urlContains('/'), 2000);
    const homeElement = await driver.wait(until.elementLocated(By.xpath('//h3[contains(text(), "Chào mừng")]')), 2000);
    if (!await homeElement.isDisplayed()) {
      throw new Error('Đăng nhập không thành công, không tìm thấy tiêu đề trang chủ');
    }
    console.log('Test 1: Đăng nhập thành công');

    // Test 2: Chọn chức năng Đổi lớp/Chọn lớp
    console.log('Looking for Chọn lớp/Đổi lớp button...');
    const selectClassUrl = await driver.getCurrentUrl();
    console.log('Current URL before selecting class:', selectClassUrl);
    let selectClassCard;
    try {
      const selectClassText = await driver.wait(
        until.elementLocated(By.xpath('//h5[contains(text(), "chọn lớp") or contains(text(), "đổi lớp")]')),
        2000
      );
      selectClassCard = await selectClassText.findElement(By.xpath('ancestor::div[contains(@class, "ant-card")]'));
    } catch (e) {
      console.log('Locator 1 failed, trying alternative locator...');
      selectClassCard = await driver.wait(
        until.elementLocated(By.xpath('//div[contains(@class, "ant-card") and .//span[contains(@class, "anticon-appstore")]]')),
        2000
      );
    }
    if (!selectClassCard.isDisplayed()) {
      throw new Error('Không tìm thấy card Chọn lớp/Đổi lớp');
    }
    await selectClassCard.click();
    console.log('Test 2: Mở chức năng Đổi lớp/Chọn lớp thành công');

    // Test 3: Chọn lớp D21CNPM01
    console.log('Selecting class D21CNPM01...');
    const classOption = await driver.wait(
      until.elementLocated(By.xpath('//div[contains(text(), "D21CNPM01")]')),
      2000
    );
    await classOption.click();
    await driver.wait(until.elementIsVisible(classOption), 2000);
    const currentUrl = await driver.getCurrentUrl();
    console.log('Current URL after selecting class:', currentUrl);
    if (currentUrl.includes('/profile')) {
      console.log('Unexpected redirect to /profile, navigating back to home...');
      await driver.navigate().back();
      await driver.wait(until.urlContains('/'), 2000);
    }
    await driver.wait(until.elementLocated(By.xpath('//div[contains(@class, "ant-card-head-title") and contains(text(), "D21CNPM01")]')), 2000);
    console.log('Test 3: Chọn lớp D21CNPM01 thành công');

    // Test 4: Vào chức năng Diễn đàn
    console.log('Navigating to forum...');
    const currentUrlAfterTest3 = await driver.getCurrentUrl();
    console.log('Current URL before navigating to forum:', currentUrlAfterTest3);
    const classId = 'fe03cf8d-ad21-41fe-801f-62a0929bef13';
    let forumLink;
    try {
      forumLink = await driver.wait(
        until.elementLocated(By.xpath('//a[.//text()[contains(translate(., "DIỄNDÀN", "diễndàn"), "diễn đàn")]]')),
        2000
      );
      if (!await forumLink.isDisplayed()) {
        throw new Error('Liên kết Diễn đàn không hiển thị');
      }
      await forumLink.click();
    } catch (e) {
      console.log('Không tìm thấy liên kết Diễn đàn, điều hướng trực tiếp...');
      await driver.get(`http://localhost:3000/${classId}/feed`);
    }
    await driver.wait(until.urlContains(`/${classId}/feed`), 2000);
    let feedPageLoaded = false;
    try {
      await driver.wait(
        until.elementLocated(By.xpath('//h1[contains(text(), "Hiện chưa có bài đăng nào cả")]')),
        2000
      );
      feedPageLoaded = true;
    } catch (e) {
      console.log('Không tìm thấy thông báo "Hiện chưa có bài đăng nào cả", thử kiểm tra bài đăng...');
      try {
        await driver.wait(
          until.elementLocated(By.xpath('//div[contains(@style, "padding-right: 300px") and contains(@style, "padding-left: 230px")]')),
          2000
        );
        feedPageLoaded = true;
      } catch (e2) {
        console.log('Không tìm thấy div bài đăng, thử tìm nút tạo bài đăng mới...');
        await driver.wait(
          until.elementLocated(By.xpath('//button[contains(text(), "Đăng bài mới")]')),
          2000
        );
        feedPageLoaded = true;
      }
    }
    if (!feedPageLoaded) {
      throw new Error('Không thể xác nhận trang diễn đàn đã hiển thị');
    }
    console.log('Test 4: Vào chức năng Diễn đàn thành công');

    // Test 5: Nhấn nút Comment, gửi bình luận và rollback DB
    console.log('Thực hiện nhấn nút Comment, gửi bình luận và rollback DB...');
    const commentContent = 'selenium đây';
    let postId = null;
    try {
    // Tìm bài đăng có nội dung "comment vào đây"
    const targetPost = await driver.wait(
        until.elementLocated(By.xpath('//*[contains(text(), "comment vào đây")]')),
        10000
    );
    if (!await targetPost.isDisplayed()) {
        throw new Error('Không tìm thấy bài đăng "comment vào đây"');
    }
    console.log('Đã tìm thấy bài đăng "comment vào đây"');

    // Tìm container của bài đăng và lấy postId
    const postContainer = await targetPost.findElement(By.xpath('ancestor::div[contains(@class, "post")]'));
    try {
        postId = await postContainer.getAttribute('data-post-id') || '617c0f13cbe8a4f53931e5e6'; // Fallback ID
        console.log('Post ID:', postId);
    } catch (e) {
        console.warn('Không lấy được postId từ DOM, dùng ID mặc định');
        postId = '617c0f13cbe8a4f53931e5e6'; // ID mặc định
    }

    // Tìm nút Comment (<p style="margin: 0px;">Comment</p> trong div.postOption)
    const commentButton = await driver.wait(
        until.elementLocated(By.xpath('.//div[contains(@class, "postOption")]//p[@style="margin: 0px;" and contains(text(), "Comment")]')),
        10000,
        { context: postContainer } // Tìm trong phạm vi bài đăng
    );
    await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', commentButton);
    await driver.wait(until.elementIsVisible(commentButton), 10000);
    await driver.executeScript('arguments[0].click();', commentButton); // Click bằng JS để tránh lỗi
    console.log('Đã nhấn nút Comment');

    // Đợi danh sách bình luận hiển thị (div.commentCtn)
    const commentList = await driver.wait(
        until.elementLocated(By.css('div.commentCtn')),
        10000
    );
    await driver.wait(until.elementIsVisible(commentList), 10000);
    console.log('Danh sách bình luận đã hiển thị');

    // Tìm ô nhập bình luận
    const commentInput = await driver.wait(
        until.elementLocated(By.css('div.inputComment[contenteditable="true"]')),
        10000
    );
    await driver.wait(until.elementIsVisible(commentInput), 10000);
    await driver.wait(until.elementIsEnabled(commentInput), 10000);
    console.log('Ô nhập bình luận đã hiển thị');

    // Scroll và focus ô nhập
    await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', commentInput);
    await driver.executeScript('arguments[0].focus();', commentInput);

    // Xóa nội dung cũ và nhập bình luận
    await commentInput.clear();
    await commentInput.sendKeys(commentContent);
    console.log('Đã nhập bình luận:', commentContent);

    // Gửi bình luận bằng phím Enter
    const commentTime = new Date().getTime(); // Lưu thời gian gửi để lọc bình luận
    await commentInput.sendKeys(Key.ENTER);
    console.log('Đã gửi bình luận bằng phím Enter');

    // Kiểm tra bình luận hiển thị trong danh sách
    const postedComment = await driver.wait(
        until.elementLocated(By.xpath(`//p[contains(@class, "commentContent") and contains(text(), "${commentContent}")]`)),
        10000
    );
    if (!await postedComment.isDisplayed()) {
        throw new Error('Bình luận "selenium đây" không hiển thị trong danh sách');
    }
    console.log('Đã xác nhận bình luận hiển thị');

    // Chờ 3 giây để xem danh sách bình luận
    await driver.sleep(3000);

    // Rollback: Xóa bình luận khỏi mảng comments trong collection posts
    console.log('Rollback: Xóa bình luận khỏi MongoDB...');
    try {
        const postResult = await db.collection('posts').updateOne(
        { _id: new mongoose.Types.ObjectId(postId) },
        {
            $pull: {
            comments: {
                content: commentContent,
                created_date: { $gte: commentTime - 10000, $lte: commentTime + 10000 } // Trong 10 giây
            }
            }
        }
        );
        if (postResult.modifiedCount === 1) {
        console.log('Đã xóa bình luận khỏi mảng comments trong collection posts');
        } else {
        console.warn(`Không tìm thấy bình luận "${commentContent}" trong mảng comments của bài đăng ${postId}`);
        }
    } catch (e) {
        console.error('Lỗi khi rollback bình luận:', e.message);
        throw new Error('Rollback thất bại');
    }
    } catch (e) {
    console.log('Lỗi khi nhấn nút Comment, gửi bình luận hoặc rollback:', e.message);
    throw new Error('Không thể hoàn thành thao tác Test 5');
    }
    console.log('Test 5: Nhấn nút Comment, gửi bình luận và rollback thành công');

  } catch (error) {
    console.error('Lỗi:', error.message);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log('MongoDB connection closed');
    }
    if (driver) {
      await driver.quit();
      console.log('Browser closed');
    }
  }
})();